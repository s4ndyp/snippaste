import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Plus, Trash2, Copy, AlertTriangle, FileText, Settings, Pencil, LogIn, HardDrive } from 'lucide-react'; 

// --- Configuratie en Standaardwaarden ---

// Namen van Local Storage keys
const SNIPPETS_STORAGE_KEY = 'snippet_manager_snippets';
const SETTINGS_STORAGE_KEY = 'snippet_manager_settings';

// Beschikbare kleuren voor snippets (subtiel donker thema)
const cardColorOptions = [
    { name: 'Default', bg: 'bg-gray-800', border: 'border-gray-700' }, // Standaard
    { name: 'Groen', bg: 'bg-green-900/40', border: 'border-green-600/50' },
    { name: 'Blauw', bg: 'bg-blue-900/40', border: 'border-blue-600/50' },
    { name: 'Paars', bg: 'bg-purple-900/40', border: 'border-purple-600/50' },
    { name: 'Geel', bg: 'bg-yellow-900/40', border: 'border-yellow-600/50' },
    { name: 'Rood', bg: 'bg-red-900/40', border: 'border-red-600/50' },
];
const DEFAULT_COLOR = cardColorOptions[0].name;
const defaultColumnTitles = ['Alle Snippets', 'In Uitvoering', 'Review', 'Voltooid'];
const PERSISTENCE_OPTIONS = ['localStorage', 'api']; 
const API_ENDPOINT = 'snippets'; // Het endpoint in de API Gateway

// Functie voor kopiëren naar klembord
const copyToClipboard = (text) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        return successful;
    } catch (err) {
        console.error('Copy failed:', err);
        document.body.removeChild(textarea);
        return false;
    }
};

// --- API Persistentie Laag (Custom Hook) ---

const useApiPersistence = (settings, authData) => {
    
    // Base URL voor de API-aanroepen
    const baseUrl = useMemo(() => {
        if (!settings.api_url) return null;
        // Zorg ervoor dat de URL eindigt op een '/' of niet
        return settings.api_url.replace(/\/+$/, '');
    }, [settings.api_url]);

    // Async utility om fetches met auth te doen
    const apiFetch = useCallback(async (path, method = 'GET', body = null) => {
        if (!baseUrl || !authData.token) {
            throw new Error("API URL of Auth Token ontbreekt.");
        }

        const url = `${baseUrl}/api/${path}`;
        
        // Exponentiële backoff retry
        for (let i = 0; i < 3; i++) {
            try {
                const response = await fetch(url, {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authData.token}`,
                    },
                    body: body ? JSON.stringify(body) : null,
                });

                if (response.status === 401 || response.status === 403) {
                     // Gooi een specifieke Auth Error
                    throw new Error("401: Authenticatie mislukt. Log opnieuw in.");
                }
                
                if (!response.ok) {
                    const errorBody = await response.json();
                    throw new Error(`API Fout (${response.status}): ${errorBody.error || response.statusText}`);
                }
                
                // Bij DELETE (204) is er geen body
                if (method === 'DELETE' && response.status === 204) {
                    return {};
                }
                
                return await response.json();

            } catch (error) {
                // Als het een Auth Error is, gooi het dan meteen door
                if (error.message.startsWith('401:')) throw error;

                // Bij de laatste poging, gooi de fout door
                if (i === 2) throw error; 

                // Wacht met exponentiële backoff
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
            }
        }
    }, [baseUrl, authData.token]);

    // Functie om in te loggen
    const login = useCallback(async (username, password) => {
        if (!baseUrl) throw new Error("API URL is niet ingesteld.");

        const url = `${baseUrl}/api/auth/login`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            if (!response.ok) {
                const errorBody = await response.json();
                throw new Error(errorBody.error || "Login mislukt.");
            }
            
            const result = await response.json();
            // Retourneert de JWT
            return { token: result.token, expiresAt: Date.now() + (result.expires_in_minutes * 60 * 1000) }; 

        } catch (error) {
            throw error;
        }
    }, [baseUrl]);

    // Functie om data op te halen
    const loadData = useCallback(async () => {
        const result = await apiFetch(`${API_ENDPOINT}?_limit=1000`);
        // API Gateway retourneert een array van { id: '...', data: { document } }
        return result.map(item => ({
            id: item.id,
            title: item.data.title,
            code: item.data.code,
            color: item.data.color,
            category: item.data.category,
            // Gebruik meta.created_at voor sortering, fallback naar Date.now()
            createdAt: item.data.meta?.created_at ? new Date(item.data.meta.created_at).getTime() : Date.now(),
        }));
    }, [apiFetch]);
    
    // Functie om een snippet op te slaan/updaten
    const saveSnippet = useCallback(async (snippet) => {
        const { id, title, code, color, category } = snippet;
        
        // De API verwacht alleen de relevante velden voor de opslag
        const apiPayload = { title, code, color, category }; 
        
        if (id) {
            // PUT: Update bestaande
            const result = await apiFetch(`${API_ENDPOINT}/${id}`, 'PUT', apiPayload);
            return {
                ...snippet,
                id: result.id,
                // Update de createdAt om de volgorde te behouden/wijzigen
                createdAt: result.data.meta?.updated_at ? new Date(result.data.meta.updated_at).getTime() : Date.now(),
            }; 
        } else {
            // POST: Nieuwe aanmaken
            const result = await apiFetch(API_ENDPOINT, 'POST', apiPayload);
            return {
                ...snippet,
                id: result.id,
                createdAt: result.data.meta?.created_at ? new Date(result.data.meta.created_at).getTime() : Date.now(),
            };
        }
    }, [apiFetch]);
    
    // Functie om te verwijderen
    const deleteSnippet = useCallback(async (id) => {
        await apiFetch(`${API_ENDPOINT}/${id}`, 'DELETE');
        return true;
    }, [apiFetch]);
    
    // De API laag retourneert de CRUD-methoden
    return useMemo(() => ({ login, loadData, saveSnippet, deleteSnippet }), [login, loadData, saveSnippet, deleteSnippet]);
};


// --- Lokale Opslag Functies ---

// Functie om initiële data te laden (Local Storage versie)
const loadLocalInitialData = async () => {
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    await delay(300); // Simuleer vertraging
    
    try {
        const storedSnippets = JSON.parse(localStorage.getItem(SNIPPETS_STORAGE_KEY) || '[]');
        const storedSettings = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}');
        
        let snippets = storedSnippets;

        // Initialiseer settings, inclusief nieuwe API velden
        const settings = {
            columnTitles: storedSettings.columnTitles || defaultColumnTitles,
            persistenceType: storedSettings.persistenceType || 'localStorage',
            api_url: storedSettings.api_url || 'http://localhost:8080', // Standaard API URL
            api_username: storedSettings.api_username || '',
            api_token: storedSettings.api_token || null, // JWT token
        };

        // Voeg voorbeeld data toe als opslag leeg is
        if (snippets.length === 0 && settings.persistenceType === 'localStorage') {
             const initialSnippets = [
                {
                    id: crypto.randomUUID(),
                    title: 'React Hook - useTitle',
                    code: 'import { useEffect } from "react";\n\nfunction useTitle(title) {\n  useEffect(() => {\n    const prevTitle = document.title;\n    document.title = title;\n    return () => { document.title = prevTitle; };\n  }, [title]);\n}',
                    color: 'Blauw',
                    category: settings.columnTitles[0],
                    createdAt: Date.now(),
                },
                {
                    id: crypto.randomUUID(),
                    title: 'Tailwind Card Layout',
                    code: '<div class="bg-gray-700 p-4 rounded-lg shadow-xl md:flex md:space-x-4">\n  <div class="flex-shrink-0">\n    <img class="h-12 w-12 rounded-full" src="..." alt="Profile">\n  </div>\n  <div>\n    <div class="text-xl font-medium text-white">Project X</div>\n    <p class="text-gray-400">Minimalistisch en responsief.</p>\n  </div>\n</div>',
                    color: 'Groen',
                    category: settings.columnTitles[1],
                    createdAt: Date.now() + 1,
                },
            ];
            localStorage.setItem(SNIPPETS_STORAGE_KEY, JSON.stringify(initialSnippets));
            snippets = initialSnippets;
        }
        
        // Sorteer op createdAt
        snippets.sort((a, b) => b.createdAt - a.createdAt);

        return { snippets, settings };

    } catch (error) {
        console.error("Fout bij het laden uit Local Storage:", error);
        return { 
            snippets: [], 
            settings: { 
                columnTitles: defaultColumnTitles, 
                persistenceType: 'localStorage',
                api_url: 'http://localhost:8080',
                api_username: '',
                api_token: null,
            } 
        };
    }
};

const persistData = async (snippets, settings, persistenceType) => {
    // Deze functie wordt alleen gebruikt om Local Storage bij te werken, 
    // aangezien API opslag direct in de CRUD-functies gebeurt.
    
    if (persistenceType === 'localStorage') {
        localStorage.setItem(SNIPPETS_STORAGE_KEY, JSON.stringify(snippets));
        
        // Zorg dat het wachtwoord NIET wordt opgeslagen, alleen de auth velden
        const settingsToStore = {
            ...settings,
            api_password: undefined, 
            // We slaan de token ook in de settings op voor persistentie
        };
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settingsToStore));
    }
};

// --- Component voor de bewerkbare kolomtitel ---
const EditableTitle = ({ title, onTitleChange }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [currentTitle, setCurrentTitle] = useState(title);

    useEffect(() => {
        setCurrentTitle(title);
    }, [title]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSave();
        }
    };

    const handleSave = () => {
        if (currentTitle.trim() && currentTitle !== title) {
            onTitleChange(currentTitle.trim());
        } else {
            setCurrentTitle(title);
        }
        setIsEditing(false);
    };

    return (
        <div className="flex items-center mb-3">
            {isEditing ? (
                <input
                    type="text"
                    value={currentTitle}
                    onChange={(e) => setCurrentTitle(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={handleKeyDown}
                    className="flex-grow text-xl font-bold bg-gray-900 border border-indigo-500 rounded-md p-1 text-white focus:outline-none transition-colors"
                    autoFocus
                />
            ) : (
                <h3
                    className="text-xl font-bold text-indigo-300 cursor-pointer hover:text-indigo-200 transition-colors"
                    onClick={() => setIsEditing(true)}
                    title="Klik om de kolomtitel te bewerken"
                >
                    {title}
                </h3>
            )}
        </div>
    );
};

// --- Component voor de snippet item - Dragable ---
const SnippetItem = ({ snippet, onDelete, onCopy, onDragStart, onDragOver, onDrop, onDragLeave, isDragging, isDropTarget, isEditMode }) => {
    const [showCode, setShowCode] = useState(false); 

    // Bepaal de kleuren op basis van de opgeslagen naam
    const colorConfig = cardColorOptions.find(c => c.name === snippet.color) || cardColorOptions[0];

    return (
        <div
            // p-2 padding
            className={`flex flex-col p-2 ${colorConfig.bg} hover:bg-gray-700/70 transition-colors rounded-lg shadow-md mb-2 cursor-grab active:cursor-grabbing border ${colorConfig.border}
                ${isDragging ? 'opacity-0' : 'opacity-100'}
                ${isDropTarget ? 'border-2 border-dashed border-yellow-500 bg-yellow-900/20' : ''}
            `}
            draggable="true"
            onDragStart={(e) => onDragStart(e, snippet.id)}
            // Voeg DND-handlers toe voor herschikken binnen kolom
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, snippet.id)}
            onDragLeave={onDragLeave} 
        >
            <div className="flex items-center justify-between">
                <div className="flex-grow min-w-0 pr-2">
                    {/* Toon de ID in de titel in edit mode */}
                     <h3 className="text-sm font-medium text-white truncate" title={`${snippet.title}${isEditMode ? ` (ID: ${snippet.id})` : ''}`}>
                        {snippet.title}
                    </h3>
                </div>
                <div className="flex-shrink-0 flex space-x-1">
                    <button
                        onClick={() => setShowCode(!showCode)}
                        className={`p-1.5 rounded-full transition-all duration-200 shadow-lg group ${showCode ? 'text-indigo-400 bg-gray-700 hover:bg-indigo-600 hover:text-white' : 'text-gray-400 bg-gray-900 hover:bg-gray-700 hover:text-white'}`}
                        title={showCode ? "Verberg Code" : "Toon Code Voorbeeld"}
                    >
                        <FileText className="w-4 h-4" /> 
                    </button>

                    <button
                        onClick={() => onCopy(snippet.code)}
                        className="p-1.5 text-green-400 bg-gray-900 rounded-full hover:bg-green-600 hover:text-white transition-all duration-200 shadow-lg group"
                        title="Kopiëren"
                    >
                        <Copy className="w-4 h-4" />
                    </button>
                    {/* ALLEEN TONEN ALS EDIT MODE AAN STAAT */}
                    {isEditMode && (
                        <button
                            onClick={() => onDelete(snippet.id)}
                            className="p-1.5 text-red-400 bg-gray-900 rounded-full hover:bg-red-600 hover:text-white transition-all duration-200 shadow-lg group"
                            title="Verwijderen"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {showCode && (
                <div className="mt-2 pt-2 border-t border-gray-700 relative animate-in slide-in-from-top-4 duration-300">
                    <pre className="overflow-auto max-h-[40vh] bg-gray-900/80 p-3 rounded-md text-gray-300 text-xs font-mono border border-indigo-500/50">
                        <code className="block whitespace-pre-wrap">
                            {snippet.code.trim()}
                        </code>
                    </pre>
                </div>
            )}
        </div>
    );
};

// --- Instellingen Weergave Component ---
const SettingsView = ({ settings, setSettings, setView, apiLogin, isLoading }) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [loginError, setLoginError] = useState(null);

    const handleSettingsChange = (e) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: value }));
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginError(null);
        if (!currentPassword) {
            setLoginError("Wachtwoord is vereist.");
            return;
        }

        try {
            // Dit is de call naar de ApiPersistence laag (apiLayer.login)
            const result = await apiLogin(settings.api_username, currentPassword);
            
            // Sla de token op in de settings state
            setSettings(prev => ({ 
                ...prev, 
                api_token: result.token, 
                // Het wachtwoord hoeft niet in de state te blijven, alleen de token
                api_password: undefined 
            }));
            
            setCurrentPassword(''); // Wis wachtwoord na succesvolle login
            setLoginError(null);
            setView('board'); // Terug naar het bord
            
            // Forceer een herlaad van de data in de hoofdcomponent
            window.dispatchEvent(new Event('storageChange')); 

        } catch (error) {
            console.error("Login fout:", error);
            setLoginError(error.message || "Onbekende login fout.");
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 bg-gray-800 rounded-xl shadow-2xl border border-gray-700">
            <h2 className="text-2xl font-bold mb-6 text-white border-b border-gray-700 pb-2">Instellingen</h2>

            <div className="space-y-6">
                {/* Gegevens Persistentie Type Kiezer */}
                <div>
                    <label className="block text-lg font-medium text-indigo-400 mb-2">Gegevens Opslag Type</label>
                    <p className="text-gray-400 mb-4 text-sm">
                        Kies hoe de applicatie gegevens opslaat. API-modus vereist inloggegevens voor de externe Gateway.
                    </p>
                    <div className="flex space-x-4">
                        {PERSISTENCE_OPTIONS.map(type => (
                            <label key={type} className={`
                                flex items-center p-3 rounded-lg cursor-pointer transition-all border
                                ${settings.persistenceType === type 
                                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' 
                                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'}
                            `}>
                                <input
                                    type="radio"
                                    name="persistenceType"
                                    value={type}
                                    checked={settings.persistenceType === type}
                                    onChange={handleSettingsChange}
                                    className="mr-2 hidden"
                                />
                                <span className="font-semibold">{type === 'localStorage' ? <><HardDrive className="w-5 h-5 mr-2" /> Lokale Opslag</> : <><LogIn className="w-5 h-5 mr-2" /> Externe API</>}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* API INSTELLINGEN BLOK */}
                {settings.persistenceType === 'api' && (
                    <div className="p-5 bg-gray-700 rounded-lg border border-gray-600 space-y-4">
                        <h3 className="text-xl font-semibold text-yellow-300">API Gateway Details</h3>
                        
                        {/* Status melding */}
                        {settings.api_token ? (
                             <div className="p-3 bg-green-900/50 border border-green-700 rounded-lg text-green-300 text-sm">
                                Succesvol ingelogd! Token is actief.
                            </div>
                        ) : (
                             <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
                                <AlertTriangle className="inline w-4 h-4 mr-2" />
                                Je moet inloggen om snippets op te halen of op te slaan.
                            </div>
                        )}

                        <form onSubmit={handleLogin} className="space-y-4">
                            {/* API URL Veld */}
                            <div>
                                <label htmlFor="api_url" className="block text-sm font-medium text-gray-300 mb-1">API Basis URL (incl. poort)</label>
                                <input
                                    type="url"
                                    id="api_url"
                                    name="api_url"
                                    value={settings.api_url}
                                    onChange={handleSettingsChange}
                                    placeholder="http://<server>:8080"
                                    required
                                    className="w-full p-2 bg-gray-900 border border-gray-600 rounded-lg text-white font-mono text-sm"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Moet linken naar de API Gateway, bijv. `http://&lt;server&gt;:8080`.
                                </p>
                            </div>

                            {/* Gebruikersnaam Veld */}
                            <div>
                                <label htmlFor="api_username" className="block text-sm font-medium text-gray-300 mb-1">Gebruikersnaam</label>
                                <input
                                    type="text"
                                    id="api_username"
                                    name="api_username"
                                    value={settings.api_username}
                                    onChange={handleSettingsChange}
                                    placeholder="API Gebruikersnaam"
                                    required
                                    className="w-full p-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm"
                                />
                            </div>

                            {/* Wachtwoord Veld */}
                            <div>
                                <label htmlFor="api_password" className="block text-sm font-medium text-gray-300 mb-1">Wachtwoord (Wordt niet opgeslagen!)</label>
                                <input
                                    type="password"
                                    id="api_password"
                                    name="api_password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="Wachtwoord"
                                    required
                                    className="w-full p-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm"
                                />
                                {loginError && <p className="text-sm text-red-400 mt-2">{loginError}</p>}
                            </div>
                            
                            {/* Login Knop */}
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-2.5 px-3 bg-green-600 text-white font-semibold rounded-lg shadow-lg hover:bg-green-500 disabled:bg-gray-600 transition-colors text-sm flex items-center justify-center"
                            >
                                {isLoading ? 'Bezig met inloggen...' : <><LogIn className="w-5 h-5 mr-2" /> Inloggen & Data Laden</>}
                            </button>
                            <button
                                type="button"
                                onClick={() => setSettings(prev => ({ ...prev, api_token: null }))}
                                className="w-full py-2 px-3 bg-red-600/50 text-red-300 font-semibold rounded-lg hover:bg-red-700/50 transition-colors text-sm"
                            >
                                Uitloggen (Token Verwijderen)
                            </button>
                        </form>
                    </div>
                )}

                {/* Terug naar Board Knop */}
                <div className="pt-4 border-t border-gray-700">
                    <button
                        onClick={() => setView('board')}
                        className="py-2 px-4 bg-indigo-500 text-white font-semibold rounded-lg hover:bg-indigo-400 transition-colors text-sm"
                    >
                        Terug naar Snippet Board
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Helper functie om een lijst sequentiële timestamps te geven ---
const reTimestampList = (list) => {
    // Gebruikt een basis timestamp die afneemt met de index, zodat index 0 de 'nieuwste' is
    const newTimestampBase = Date.now();
    return list.map((item, index) => ({
        ...item,
        // Garandeert dat het bovenaan (index 0) de hoogste createdAt heeft
        createdAt: newTimestampBase - index, 
    }));
};


// --- Hoofd Applicatie Component ---
const App = () => {
    const [view, setView] = useState('board'); // 'board' of 'settings'
    const [snippets, setSnippets] = useState([]);
    const [settings, setSettings] = useState({ 
        columnTitles: defaultColumnTitles, 
        persistenceType: 'localStorage',
        api_url: 'http://localhost:8080',
        api_username: '',
        api_token: null,
    });
    
    const [searchTerm, setSearchTerm] = useState('');
    const [copyFeedback, setCopyFeedback] = useState({ message: '', visible: false });
    
    const [newSnippet, setNewSnippet] = useState({
        title: '',
        color: DEFAULT_COLOR,
        code: '',
    });

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [draggedId, setDraggedId] = useState(null);
    const [dropTargetId, setDropTargetId] = useState(null); 
    const [isEditMode, setIsEditMode] = useState(false); 

    // Instantie van de API Persistentie Laag
    // De dependency array moet worden bijgewerkt om alle dependencies te bevatten die de ApiPersistence hook bepalen
    const apiLayer = useApiPersistence(settings, { token: settings.api_token });

    // Initial Data Load (Gebruikt bij opstarten en bij wisselen van persistenceType)
    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { snippets: loadedSnippets, settings: loadedSettings } = await loadLocalInitialData();
            
            // Overname van Local Storage settings
            setSettings(loadedSettings);
            
            let finalSnippets = loadedSnippets;

            if (loadedSettings.persistenceType === 'api' && loadedSettings.api_token) {
                // Als API is gekozen EN we hebben een token, laad dan van de API
                // Gebruik de ApiPersistence instance met de geladen token
                // Omdat we in een callback zitten en geen hooks kunnen aanroepen, moeten we dit anders oplossen.
                // In dit geval gebruiken we de apiLayer die als dependency wordt meegegeven.
                // Echter, apiLayer is afhankelijk van de HUIDIGE settings, niet de GELADEN settings.
                // Dit is een complexe edge case. Voor nu gaan we ervan uit dat als we laden, we de state updaten
                // en de useEffect op [settings.persistenceType] zal triggeren voor de api fetch.
                
                // We laden alleen de lokale snippets eerst. De API fetch komt na de state update.
                 finalSnippets = []; 
            } else if (loadedSettings.persistenceType === 'api' && !loadedSettings.api_token) {
                // API gekozen maar geen token, dus we zijn niet ingelogd
                 setError("API modus actief maar niet ingelogd. Ga naar Instellingen.");
                 finalSnippets = [];
            }
            
            setSnippets(finalSnippets);

        } catch (e) {
            console.error("Fout bij het laden van data:", e);
            if (e.message.startsWith('401:')) {
                // Auth fout: wis de token en forceer naar settings
                setSettings(prev => ({ ...prev, api_token: null }));
                setView('settings');
                setError(e.message);
            } else {
                 setError(`Kon de data niet laden in de ${settings.persistenceType} modus. (${e.message})`);
            }
            setSnippets([]); // Leeg de lijst bij fout
        } finally {
            setIsLoading(false);
        }
    }, [settings.persistenceType]); // Herlaad bij verandering van type

    // Effect voor API data loading
    useEffect(() => {
        const fetchApiData = async () => {
             if (settings.persistenceType === 'api' && settings.api_token) {
                setIsLoading(true);
                try {
                    const data = await apiLayer.loadData();
                    setSnippets(data);
                    setError(null);
                } catch (e) {
                     console.error("API Load Error", e);
                     if (e.message.startsWith('401:')) {
                        setSettings(prev => ({ ...prev, api_token: null }));
                        setView('settings');
                        setError(e.message);
                    } else {
                        setError(`Kon data niet ophalen: ${e.message}`);
                    }
                } finally {
                    setIsLoading(false);
                }
             }
        };
        fetchApiData();
    }, [settings.persistenceType, settings.api_token, apiLayer]); // Trigger als API modus actief is

    useEffect(() => {
        loadData();
        // Luister naar een custom event om geforceerd te herladen na login
        window.addEventListener('storageChange', loadData);
        return () => window.removeEventListener('storageChange', loadData);
    }, [loadData]);


    // Data Persistentie van Local Storage/Settings (triggered na elke wijziging in settings)
    useEffect(() => {
        // Alleen Local Storage settings persisteren hier. Snippets alleen als localStorage type.
        persistData(settings.persistenceType === 'localStorage' ? snippets : [], settings, settings.persistenceType);
    }, [settings, snippets]); 


    // Update column titles
    const handleUpdateColumnTitle = async (index, newTitle) => {
        const newTitles = [...settings.columnTitles];
        newTitles[index] = newTitle;
        // Update de settings state
        setSettings(prev => ({ ...prev, columnTitles: newTitles }));
    };

    // Handle form input changes
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewSnippet(prev => ({ ...prev, [name]: value }));
    };

    // Functie om klembord te plakken en titel te vullen
    const handlePaste = async () => {
        try {
            const clipboardText = await navigator.clipboard.readText();
            if (clipboardText) {
                const trimmedContent = clipboardText.trim();
                let titleContent = trimmedContent.substring(0, 12);
                
                const newTitle = trimmedContent.length > 12 
                    ? titleContent.trim() + '...' 
                    : titleContent.trim();

                setNewSnippet(prev => ({
                    ...prev,
                    code: clipboardText,
                    title: newTitle || 'Plak Snippet' // Zorg voor een fallback titel
                }));

                setCopyFeedback({ message: 'Inhoud uit klembord geplakt en titel gevuld!', visible: true });
            }
        } catch (err) {
            console.error('Klembord lezen mislukt:', err);
            setCopyFeedback({ 
                message: 'Klembordtoegang geblokkeerd. Plak de code handmatig in het codeveld (Ctrl/Cmd+V).', 
                visible: true 
            });
            const titlePlaceholder = 'Titel handmatig plakken...';
             setNewSnippet(prev => ({
                 ...prev,
                 title: titlePlaceholder
             }));
        } finally {
            setTimeout(() => setCopyFeedback({ message: '', visible: false }), 4000);
        }
    };

    // Add new snippet
    const handleSaveSnippet = async (e) => {
        e.preventDefault();
        if (!newSnippet.title || !newSnippet.code) return;
        if (settings.persistenceType === 'api' && !settings.api_token) {
            setError("Niet ingelogd. Ga naar Instellingen om in te loggen op de API.");
            return;
        }

        try {
            setIsLoading(true);
            
            const baseSnippet = {
                title: newSnippet.title,
                code: newSnippet.code,
                color: newSnippet.color,
                category: settings.columnTitles[0], // Altijd in de eerste kolom
                // De ID en createdAt worden door de persistentielaag ingesteld of geüpdatet
            };
            
            let savedSnippet;

            if (settings.persistenceType === 'api') {
                // API opslag
                savedSnippet = await apiLayer.saveSnippet(baseSnippet);
            } else {
                // Lokale opslag simulatie
                savedSnippet = {
                    ...baseSnippet,
                    id: crypto.randomUUID(),
                    createdAt: Date.now() + 10000, 
                };
            }

            // Voeg lokaal toe en sorteer
            setSnippets(prev => [...prev.filter(s => s.id !== savedSnippet.id), savedSnippet].sort((a, b) => b.createdAt - a.createdAt));

            // Clear the form
            setNewSnippet({ title: '', color: DEFAULT_COLOR, code: '' });
        } catch (e) {
            console.error("Fout bij het toevoegen van snippet:", e);
            setError(`Fout bij het opslaan van de snippet: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Delete snippet
    const handleDeleteSnippet = async (id) => {
        if (!isEditMode) return; 
         if (settings.persistenceType === 'api' && !settings.api_token) {
            setError("Niet ingelogd. Ga naar Instellingen om in te loggen op de API.");
            return;
        }
        
        try {
            if (settings.persistenceType === 'api') {
                 await apiLayer.deleteSnippet(id);
            }
            
            // Filter lokaal in beide modi
            setSnippets(prev => prev.filter(s => s.id !== id));
        } catch (e) {
            console.error("Fout bij het verwijderen van snippet:", e);
            setError(`Fout bij het verwijderen van de snippet: ${e.message}`);
        }
    };

    // Update snippet category for DND
    const updateSnippetCategory = async (snippet, newCategory) => {
        // Alleen bij verandering
        if (snippet.category === newCategory) return;
        
        const updatedSnippet = { 
            ...snippet, 
            category: newCategory,
            // Geef een hoge timestamp om bovenaan de nieuwe kolom te komen
            createdAt: Date.now() + 10000 
        };

        try {
            let savedSnippet = updatedSnippet;
            if (settings.persistenceType === 'api') {
                // PUT naar API om de categorie te updaten
                savedSnippet = await apiLayer.saveSnippet(updatedSnippet);
            } 
            
            // Update lokaal en sorteer
            setSnippets(prev => 
                [...prev.filter(s => s.id !== savedSnippet.id), savedSnippet]
                .sort((a, b) => b.createdAt - a.createdAt)
            );

        } catch (e) {
             console.error("Fout bij het updaten van de categorie:", e);
             setError(`Kon categorie niet updaten: ${e.message}`);
        }
    };

    // Update snippet order (binnen een kolom)
    const updateSnippetOrder = async (reorderedColumn) => {
        try {
            // Dit is enkel visueel in LocalStorage modus
            if (settings.persistenceType === 'api') {
                 // Sla de gewijzigde snippets één voor één op om de 'updated_at' timestamp te veranderen
                 // Dit is een simpele manier om de volgorde te persisteren, omdat de API Gateway op created_at/updated_at sorteert
                 setIsLoading(true);
                 for (const snippet of reorderedColumn) {
                      // We hoeven niet alle velden te sturen, maar de saveSnippet functie verwacht een volledig object
                      // Omdat dit een PUT is, zal de API alleen de gestuurde velden overschrijven/gebruiken
                      await apiLayer.saveSnippet(snippet);
                 }
                 // Na de updates, herlaad de data om de nieuwe volgorde te reflecteren
                 // Aangezien we in een lus zitten, is het beter om de API data pas aan het einde op te halen
                 // We kunnen hier de loadData van de hook gebruiken
                 const newData = await apiLayer.loadData();
                 setSnippets(newData);
                 return;
            }
            // In LocalStorage modus hoeft alleen de lokale state aangepast te worden.

        } catch (e) {
            console.error("Fout bij het herschikken van snippets:", e);
            setError(`Kon snippets niet herschikken: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    }


    // DND Handlers
    const handleDragStart = (e, snippetId) => {
        e.dataTransfer.setData("snippetId", snippetId);
        setDraggedId(snippetId);
    };

    const handleDragOverItem = (e, targetId) => {
        e.preventDefault();
        e.stopPropagation(); 
        const draggedItem = e.dataTransfer.getData("snippetId");
        if (draggedItem && draggedItem !== targetId) {
            setDropTargetId(targetId);
        }
    };
    
    const handleDragLeaveItem = () => {
        setDropTargetId(null);
    };

    const handleDropOnItem = (e, targetId) => {
        e.preventDefault();
        e.stopPropagation();
        
        const draggedId = e.dataTransfer.getData("snippetId");
        setDropTargetId(null);
        
        if (!draggedId || draggedId === targetId) return;

        setSnippets(prevSnippets => {
            const draggedSnippet = prevSnippets.find(s => s.id === draggedId);
            if (!draggedSnippet) return prevSnippets;
            
            // 1. Haal items in de categorie op en sorteer op de huidige volgorde (createdAt)
            let columnItems = prevSnippets.filter(s => s.category === draggedSnippet.category).sort((a, b) => b.createdAt - a.createdAt);
            
            // 2. Verwijder en voeg lokaal in op de nieuwe plek
            const dragIndex = columnItems.findIndex(s => s.id === draggedId);
            const targetIndex = columnItems.findIndex(s => s.id === targetId);

            const [removed] = columnItems.splice(dragIndex, 1);
            columnItems.splice(targetIndex, 0, removed); // Insert voor het doelwit

            // 3. Geef de gewijzigde kolom een nieuwe set sequentiële timestamps
            const reorderedColumn = reTimestampList(columnItems);

            // 4. Update API/Local Storage (asynchroon)
            // Zorg ervoor dat de 'createdAt' van de gesleepte snippet de hoogste is (nieuwste),
            // en de rest afloopt. Dit wordt gedaan door reTimestampList.
            updateSnippetOrder(reorderedColumn);

            // 5. Voeg terug in de totale lijst en retourneer de lokaal gesorteerde lijst
            const otherSnippets = prevSnippets.filter(s => s.category !== draggedSnippet.category);
            return [...otherSnippets, ...reorderedColumn].sort((a, b) => b.createdAt - a.createdAt);
        });
    };

    const handleDragOverColumn = (e) => {
        e.preventDefault();
        setDropTargetId(null); 
    };

    const handleDropOnColumn = (e, targetColumnTitle) => {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData("snippetId");
        setDraggedId(null);
        setDropTargetId(null);

        if (!draggedId) return;

        const draggedSnippet = snippets.find(s => s.id === draggedId);
        if (!draggedSnippet) return;

        // Als de kolom verandert, update de categorie en trigger API/Local opslag
        if (draggedSnippet.category !== targetColumnTitle) {
            updateSnippetCategory(draggedSnippet, targetColumnTitle);
        } else {
             // Drop in lege ruimte (Herschikken naar top van huidige kolom)
             setSnippets(prevSnippets => {
                let columnItems = prevSnippets.filter(s => s.category === targetColumnTitle).sort((a, b) => b.createdAt - a.createdAt);
                
                const dragIndex = columnItems.findIndex(s => s.id === draggedId);
                const [removed] = columnItems.splice(dragIndex, 1);
                columnItems.unshift(removed);

                const reorderedColumn = reTimestampList(columnItems);
                
                // Update API/Local Storage (asynchroon)
                updateSnippetOrder(reorderedColumn);

                const otherSnippets = prevSnippets.filter(s => s.category !== targetColumnTitle);
                return [...otherSnippets, ...reorderedColumn].sort((a, b) => b.createdAt - a.createdAt);
             });
        }
    };

    // Copy snippet code and show feedback
    const handleCopy = (code) => {
        if (copyToClipboard(code)) {
            setCopyFeedback({ message: 'Snippet succesvol gekopieerd!', visible: true });
        } else {
            setCopyFeedback({ message: 'Kopiëren mislukt. Probeer handmatig.', visible: true });
        }
        
        setTimeout(() => {
            setCopyFeedback({ message: '', visible: false });
        }, 3000);
    };

    // Functie om snippets per kolom te verdelen en te filteren
    const getSnippetsForColumn = (title) => {
        const term = searchTerm.toLowerCase().trim();
        
        let columnSnippets = snippets.filter(s => s.category === title);
        
        if (term) {
            // Filter op titel of code
            columnSnippets = columnSnippets.filter(snippet =>
                snippet.title.toLowerCase().includes(term) ||
                snippet.code.toLowerCase().includes(term) 
            );
        }
        
        return columnSnippets;
    };


    const renderSnippetBoard = () => (
        <>
             {/* 1. Nieuwe Snippet Formulier (Bovenaan) */}
            <div className="mb-8 max-w-4xl mx-auto"> 
                <h2 className="text-2xl font-bold mb-4 text-indigo-400">Nieuwe Snippet Toevoegen</h2>
                {settings.persistenceType === 'api' && !settings.api_token && (
                    <div className="flex items-center p-4 mb-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300">
                        <AlertTriangle className="w-5 h-5 mr-3" />
                        <p className="font-medium">Niet ingelogd in API modus. Ga naar <button onClick={() => setView('settings')} className="text-red-300 underline font-bold">Instellingen</button> om in te loggen.</p>
                    </div>
                )}
                <form onSubmit={handleSaveSnippet} className="p-6 bg-gray-800 rounded-xl shadow-2xl border border-gray-700">
                    
                    {/* Titel en Kleurkiezer */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="md:col-span-1">
                            <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-1">Titel</label>
                            <input
                                type="text"
                                id="title"
                                name="title"
                                value={newSnippet.title}
                                onChange={handleInputChange}
                                placeholder="Naam van de snippet"
                                required
                                className="w-full p-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-white transition-colors text-sm"
                            />
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-sm font-medium text-gray-300 mb-1">Kleur (Visuele Categorie)</label>
                            <div className="flex flex-wrap gap-2 p-2 bg-gray-900 border border-gray-700 rounded-lg min-h-[38px] overflow-y-auto">
                                {cardColorOptions.map(color => (
                                    <div 
                                        key={color.name}
                                        className={`
                                            w-6 h-6 rounded-full cursor-pointer transition-all border-2 
                                            ${color.bg}
                                            ${newSnippet.color === color.name ? 'border-white ring-2 ring-indigo-500' : 'border-transparent hover:border-gray-500'}
                                        `}
                                        onClick={() => setNewSnippet(prev => ({ ...prev, color: color.name }))}
                                        title={color.name}
                                    >
                                    </div>
                                ))}
                            </div>
                        </div>
                         {/* Opslaan Knop en Plakken Knop */}
                        <div className="md:col-span-1 flex flex-col space-y-2">
                            <button
                                type="button" 
                                onClick={handlePaste}
                                // Subtiel oranje
                                className="w-full py-2.5 px-3 bg-orange-800 text-orange-300 font-semibold rounded-lg shadow-lg hover:bg-orange-700 focus:outline-none focus:ring-4 focus:ring-orange-700 transition-all duration-200 flex items-center justify-center text-sm"
                            >
                                <Copy className="w-5 h-5 mr-1" />
                                Plakken & Titel Vullen
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading || !newSnippet.title || !newSnippet.code || (settings.persistenceType === 'api' && !settings.api_token)}
                                className="w-full py-2.5 px-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-lg hover:bg-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-700 disabled:bg-indigo-900 disabled:text-gray-500 transition-all duration-200 flex items-center justify-center text-sm"
                            >
                                <Plus className="w-5 h-5 mr-1" />
                                {isLoading ? 'Bezig met opslaan...' : 'Snippet Opslaan'}
                            </button>
                        </div>
                    </div>

                    {/* Code Veld */}
                    <div className="mb-4">
                        <label htmlFor="code" className="block text-sm font-medium text-gray-300 mb-1">Code</label>
                        <textarea
                            id="code"
                            name="code"
                            value={newSnippet.code}
                            onChange={handleInputChange}
                            placeholder="Plak hier je code..."
                            rows="4"
                            required
                            className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg font-mono text-sm focus:ring-indigo-500 focus:border-indigo-500 text-white resize-none transition-colors"
                        ></textarea>
                    </div>
                </form>
            </div>

            {/* 2. Snippet Overzicht (Vier Kolommen) */}
            <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between">
                <h2 className="text-2xl font-bold text-white mb-3 md:mb-0">Snippet Overzicht</h2>
                
                <div className="relative w-full md:w-1/3">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Zoeken op titel of code..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white transition-colors text-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
            </div>
            
            {/* KOLOMMEN CONTAINER: gap-3 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {settings.columnTitles.map((title, index) => {
                    const columnSnippets = getSnippetsForColumn(title);

                    return (
                        <div 
                            key={index} 
                            // KOLOM PADDING: p-3
                            className={`bg-gray-800/50 p-3 rounded-xl border border-gray-700 shadow-xl min-h-[500px] transition-colors`}
                            onDragOver={handleDragOverColumn}
                            onDrop={(e) => handleDropOnColumn(e, title)}
                        >
                            {/* Aanpasbare Titel */}
                            <EditableTitle
                                title={title}
                                onTitleChange={(newTitle) => handleUpdateColumnTitle(index, newTitle)}
                            />
                            
                            {/* Snippet Lijst */}
                            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                {isLoading && index === 0 ? (
                                    <div className="flex items-center justify-center p-4 text-gray-400">
                                        <svg className="animate-spin h-5 w-5 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Laden...
                                    </div>
                                ) : columnSnippets.length === 0 ? (
                                    <p className="text-gray-600 text-center p-4 text-sm">
                                        Geen snippets gevonden in "{title}".
                                    </p>
                                ) : (
                                    columnSnippets.map(snippet => (
                                        <SnippetItem
                                            key={snippet.id}
                                            snippet={snippet}
                                            onDelete={handleDeleteSnippet}
                                            onCopy={handleCopy}
                                            onDragStart={handleDragStart}
                                            // DND handlers voor herschikken binnen kolom
                                            onDragOver={(e) => handleDragOverItem(e, snippet.id)}
                                            onDrop={(e) => handleDropOnItem(e, snippet.id)}
                                            onDragLeave={handleDragLeaveItem}
                                            isDragging={draggedId === snippet.id}
                                            isDropTarget={dropTargetId === snippet.id}
                                            isEditMode={isEditMode} 
                                        />
                                    ))
                                )}

                            </div>
                        </div>
                    );
                })}
            </div>
        </>
    );

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 p-4 sm:p-8 font-sans">
            <header className="mb-8 border-b border-gray-700 pb-4 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-extrabold text-white tracking-tight">Code Snippet Manager</h1>
                    <p className="text-sm text-gray-400 mt-1">
                        Opslagmodus: <span className="font-mono text-xs bg-gray-800 p-1 rounded-md text-indigo-400">{settings.persistenceType}</span>
                    </p>
                </div>
                {/* Knoppen Groep */}
                <div className="flex space-x-3">
                    {/* Bewerken Modus Toggle */}
                    <button
                        onClick={() => setIsEditMode(prev => !prev)}
                        className={`p-3 rounded-lg transition-colors shadow-lg ${isEditMode 
                            ? 'bg-red-600 text-white hover:bg-red-500' 
                            : 'bg-gray-800 text-yellow-400 hover:bg-gray-700'
                        }`}
                        title={isEditMode ? "Verlaat Bewerken Modus" : "Activeer Bewerken Modus (Verwijderen inschakelen)"}
                    >
                        <Pencil className="w-6 h-6" /> 
                    </button>

                    {/* Instellingen Knop */}
                    <button
                        onClick={() => setView('settings')}
                        className="p-3 bg-gray-800 rounded-lg text-indigo-400 hover:bg-gray-700 transition-colors shadow-lg"
                        title="Instellingen"
                    >
                        <Settings className="w-6 h-6" />
                    </button>
                </div>
            </header>

            {/* Global Error and Loading States */}
            {error && (
                <div className="flex items-center p-4 mb-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300">
                    <AlertTriangle className="w-5 h-5 mr-3" />
                    <p className="font-medium">{error}</p>
                </div>
            )}

            {/* Weergave logica */}
            {view === 'board' ? 
                renderSnippetBoard() : 
                <SettingsView 
                    settings={settings} 
                    setSettings={setSettings} 
                    setView={setView} 
                    apiLogin={apiLayer.login}
                    isLoading={isLoading} 
                />
            }

            {/* Copy Feedback Toast */}
            {copyFeedback.visible && (
                <div className="fixed bottom-6 right-6 p-4 bg-green-600 text-white rounded-lg shadow-xl transition-opacity duration-300 z-50">
                    {copyFeedback.message}
                </div>
            )}

             {/* Custom Scrollbar Styling (voor de lijst) */}
             <style jsx="true">{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #1f2937; /* Gray 800 */
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #4b5563; /* Gray 600 */
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #6b7280; /* Gray 500 */
                }
            `}</style>
        </div>
    );
};

export default App;
