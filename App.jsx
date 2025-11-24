import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, Copy, AlertTriangle, FileText, Settings, Pencil } from 'lucide-react'; 

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
const PERSISTENCE_OPTIONS = ['localStorage', 'api']; // API is nog niet functioneel, alleen Local Storage

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

// --- Lokale Opslag Functies (simuleren asynchrone API calls) ---

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const loadInitialData = async (persistenceType) => {
    await delay(300); // Simuleer netwerkvertraging

    if (persistenceType === 'localStorage') {
        try {
            const storedSnippets = JSON.parse(localStorage.getItem(SNIPPETS_STORAGE_KEY) || '[]');
            const storedSettings = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}');
            
            let snippets = storedSnippets;

            // Initialiseer settings
            const settings = {
                columnTitles: storedSettings.columnTitles || defaultColumnTitles,
                persistenceType: storedSettings.persistenceType || 'localStorage',
            };

            // Voeg voorbeeld data toe als opslag leeg is
            if (snippets.length === 0) {
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
                    {
                        id: crypto.randomUUID(),
                        title: 'Python Dict Sort',
                        code: 'data = {"c": 3, "a": 1, "b": 2}\n\n# Sort op sleutel\nsorted_keys = dict(sorted(data.items()))\nprint(sorted_keys)\n\n# Sort op waarde\nsorted_values = dict(sorted(data.items(), key=lambda item: item[1]))\nprint(sorted_values)',
                        color: 'Paars',
                        category: settings.columnTitles[0],
                        createdAt: Date.now() + 2,
                    }
                ];
                localStorage.setItem(SNIPPETS_STORAGE_KEY, JSON.stringify(initialSnippets));
                snippets = initialSnippets;
            }
            
            // Sorteer op createdAt
            snippets.sort((a, b) => b.createdAt - a.createdAt);

            return { snippets, settings };

        } catch (error) {
            console.error("Fout bij het laden uit Local Storage:", error);
            return { snippets: [], settings: { columnTitles: defaultColumnTitles, persistenceType: 'localStorage' } };
        }
    } else {
        // MOCK API: Log de actie maar retourneer geen data
        console.log(`[API MOCK] Gegevens ophalen via API is nog niet geïmplementeerd.`);
        return { 
            snippets: [], 
            settings: { columnTitles: defaultColumnTitles, persistenceType: 'api' }
        };
    }
};

const persistData = async (snippets, settings, persistenceType) => {
    await delay(100); // Simuleer netwerkvertraging

    if (persistenceType === 'localStorage') {
        localStorage.setItem(SNIPPETS_STORAGE_KEY, JSON.stringify(snippets));
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } else {
        // MOCK API: Log de actie
        console.log(`[API MOCK] Opslaan naar API: ${snippets.length} snippets.`);
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
                    <h3 className="text-sm font-medium text-white truncate" title={snippet.title}>
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
const SettingsView = ({ persistenceType, setPersistenceType, setView }) => {
    const handleTypeChange = (e) => {
        setPersistenceType(e.target.value);
    };

    return (
        <div className="max-w-2xl mx-auto p-6 bg-gray-800 rounded-xl shadow-2xl border border-gray-700">
            <h2 className="text-2xl font-bold mb-6 text-white border-b border-gray-700 pb-2">Instellingen</h2>

            <div className="space-y-6">
                {/* Gegevens Persistentie Type Kiezer */}
                <div>
                    <label className="block text-lg font-medium text-indigo-400 mb-2">Gegevens Opslag Type</label>
                    <p className="text-gray-400 mb-4 text-sm">
                        Kies hoe de applicatie gegevens opslaat. Let op: de API-modus is momenteel een mock en retourneert geen echte gegevens.
                    </p>
                    <div className="flex space-x-4">
                        {PERSISTENCE_OPTIONS.map(type => (
                            <label key={type} className={`
                                flex items-center p-3 rounded-lg cursor-pointer transition-all border
                                ${persistenceType === type 
                                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' 
                                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'}
                            `}>
                                <input
                                    type="radio"
                                    name="persistence"
                                    value={type}
                                    checked={persistenceType === type}
                                    onChange={handleTypeChange}
                                    className="mr-2 hidden"
                                />
                                <span className="font-semibold">{type === 'localStorage' ? 'Lokale Opslag (Testmodus)' : 'Externe API (Mock)'}</span>
                            </label>
                        ))}
                    </div>
                </div>

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
    const [columnTitles, setColumnTitles] = useState(defaultColumnTitles);
    const [persistenceType, setPersistenceType] = useState('localStorage'); // Standaard Local Storage
    
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

    // Initial Data Load (Gebruikt bij opstarten en bij wisselen van persistenceType)
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const { snippets: loadedSnippets, settings: loadedSettings } = await loadInitialData(persistenceType);
                setSnippets(loadedSnippets);
                setColumnTitles(loadedSettings.columnTitles);
                setPersistenceType(loadedSettings.persistenceType); // Zet op basis van Local Storage of default
            } catch (e) {
                console.error("Fout bij het laden van data:", e);
                setError(`Kon de data niet laden in de ${persistenceType} modus.`);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [persistenceType]);

    // Data Persistentie (triggered na elke wijziging in snippets of columnTitles)
    useEffect(() => {
        // Zorg ervoor dat de data alleen wordt opgeslagen nadat deze is geladen
        if (!isLoading) {
            const saveCurrentData = async () => {
                const settings = { columnTitles, persistenceType };
                // Sorteer de snippets voor het opslaan om de correcte volgorde te garanderen
                const sortedSnippets = [...snippets].sort((a, b) => b.createdAt - a.createdAt);
                await persistData(sortedSnippets, settings, persistenceType);
            };
            saveCurrentData();
        }
    }, [snippets, columnTitles, persistenceType, isLoading]); 

    // Update column titles in Local Storage/API
    const handleUpdateColumnTitle = async (index, newTitle) => {
        const newTitles = [...columnTitles];
        newTitles[index] = newTitle;
        setColumnTitles(newTitles);
    };

    // Handle form input changes
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewSnippet(prev => ({ ...prev, [name]: value }));
    };

    // Functie om klembord te plakken en titel te vullen
    const handlePaste = async () => {
        try {
            // Probeer de Clipboard API te gebruiken
            const clipboardText = await navigator.clipboard.readText();
            if (clipboardText) {
                // Gebruik de eerste 12 non-whitespace karakters voor de titel
                const trimmedContent = clipboardText.trim();
                let titleContent = trimmedContent.substring(0, 12);
                
                // Voeg '...' toe als de content langer is dan de preview
                const newTitle = trimmedContent.length > 12 
                    ? titleContent.trim() + '...' 
                    : titleContent.trim();


                setNewSnippet(prev => ({
                    ...prev,
                    code: clipboardText,
                    title: newTitle
                }));

                // Visuele feedback
                setCopyFeedback({ message: 'Inhoud uit klembord geplakt en titel gevuld!', visible: true });
            }
        } catch (err) {
            console.error('Klembord lezen mislukt (NotAllowedError/PermissionsPolicy):', err);
            // Vraag de gebruiker om de code handmatig in het veld te plakken, aangezien de browser de API blokkeert in deze omgeving.
            setCopyFeedback({ 
                message: 'Klembordtoegang geblokkeerd. Plak de code handmatig in het codeveld (Ctrl/Cmd+V).', 
                visible: true 
            });
            // Vul de titel alsnog voor, zodat de gebruiker alleen hoeft te plakken.
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

        try {
            setIsLoading(true);
            const newSnippetObject = {
                id: crypto.randomUUID(),
                title: newSnippet.title,
                code: newSnippet.code,
                color: newSnippet.color,
                category: columnTitles[0], 
                createdAt: Date.now() + 10000, // Zorgt ervoor dat nieuwe snippets bovenaan komen
            };
            
            // Voeg lokaal toe en sorteer
            setSnippets(prev => [...prev, newSnippetObject].sort((a, b) => b.createdAt - a.createdAt));

            // Clear the form
            setNewSnippet({ title: '', color: DEFAULT_COLOR, code: '' });
        } catch (e) {
            console.error("Fout bij het toevoegen van snippet:", e);
            setError("Fout bij het opslaan van de snippet.");
        } finally {
            setIsLoading(false);
        }
    };

    // Delete snippet
    const handleDeleteSnippet = async (id) => {
        if (!isEditMode) return; // Vereist dat de bewerk modus aan staat
        try {
            setSnippets(prev => prev.filter(s => s.id !== id));
        } catch (e) {
            console.error("Fout bij het verwijderen van snippet:", e);
            setError("Fout bij het verwijderen van de snippet.");
        }
    };

    // DND Handlers
    const handleDragStart = (e, snippetId) => {
        e.dataTransfer.setData("snippetId", snippetId);
        setDraggedId(snippetId);
    };

    // Handler voor slepen OVER een ander item (binnen een kolom)
    const handleDragOverItem = (e, targetId) => {
        e.preventDefault();
        e.stopPropagation(); 
        
        const draggedItem = e.dataTransfer.getData("snippetId");
        if (draggedItem && draggedItem !== targetId) {
            setDropTargetId(targetId);
        }
    };
    
    // Handler voor slepen VERLAAT een item
    const handleDragLeaveItem = () => {
        setDropTargetId(null);
    };

    // Handler voor drop op een snippet (herschikken binnen de kolom)
    const handleDropOnItem = (e, targetId) => {
        e.preventDefault();
        e.stopPropagation();
        
        const draggedId = e.dataTransfer.getData("snippetId");
        setDropTargetId(null);
        
        if (!draggedId || draggedId === targetId) return;

        setSnippets(prevSnippets => {
            const draggedSnippet = prevSnippets.find(s => s.id === draggedId);
            if (!draggedSnippet) return prevSnippets;
            
            // 1. Haal items in de categorie op en sorteer op de huidige volgorde
            let columnItems = prevSnippets.filter(s => s.category === draggedSnippet.category).sort((a, b) => b.createdAt - a.createdAt);
            
            // 2. Verwijder en voeg lokaal in op de nieuwe plek
            const dragIndex = columnItems.findIndex(s => s.id === draggedId);
            const targetIndex = columnItems.findIndex(s => s.id === targetId);

            const [removed] = columnItems.splice(dragIndex, 1);
            columnItems.splice(targetIndex, 0, removed); // Insert voor het doelwit

            // 3. Geef de gewijzigde kolom een nieuwe set sequentiële timestamps
            const reorderedColumn = reTimestampList(columnItems);

            // 4. Voeg terug in de totale lijst
            const otherSnippets = prevSnippets.filter(s => s.category !== draggedSnippet.category);
            
            // 5. Retourneer de samengevoegde en finaal gesorteerde lijst (garandeert re-render)
            return [...otherSnippets, ...reorderedColumn].sort((a, b) => b.createdAt - a.createdAt);
        });
    };

    // Handler voor slepen OVER de kolom (niet over een item)
    const handleDragOverColumn = (e) => {
        e.preventDefault();
        setDropTargetId(null); // Reset drop target als we over de kolom slepen
    };

    // Handler voor drop op de kolom (verplaatsen naar een andere kolom of naar de top van de huidige)
    const handleDropOnColumn = (e, targetColumnTitle) => {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData("snippetId");
        setDraggedId(null);
        setDropTargetId(null);

        if (!draggedId) return;

        setSnippets(prevSnippets => {
            const draggedSnippet = prevSnippets.find(s => s.id === draggedId);
            if (!draggedSnippet) return prevSnippets;
            
            // Items in de doelcategorie
            let columnItems = prevSnippets.filter(s => s.category === targetColumnTitle).sort((a, b) => b.createdAt - a.createdAt);
            
            // 1. Als de categorie verandert:
            if (draggedSnippet.category !== targetColumnTitle) {
                // Update categorie en geef hoogste timestamp voor top-positionering
                const updatedSnippet = { ...draggedSnippet, category: targetColumnTitle, createdAt: Date.now() + 10000 };
                
                const otherSnippets = prevSnippets.filter(s => s.id !== draggedId);
                
                return [...otherSnippets, updatedSnippet].sort((a, b) => b.createdAt - a.createdAt);
            }

            // 2. Drop in lege ruimte (Herschikken naar top van huidige kolom)
            
            // Verwijder en plaats bovenaan (index 0)
            const dragIndex = columnItems.findIndex(s => s.id === draggedId);
            const [removed] = columnItems.splice(dragIndex, 1);
            columnItems.unshift(removed);

            // Geef de gewijzigde kolom een nieuwe set sequentiële timestamps
            const reorderedColumn = reTimestampList(columnItems);

            // Voeg terug in de totale lijst
            const otherSnippets = prevSnippets.filter(s => s.category !== targetColumnTitle);
            
            return [...otherSnippets, ...reorderedColumn].sort((a, b) => b.createdAt - a.createdAt);
        });
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
                                disabled={isLoading || !newSnippet.title || !newSnippet.code}
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
                {columnTitles.map((title, index) => {
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
                                            isEditMode={isEditMode} // NIEUW: geef de edit modus status door
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
                        Opslagmodus: <span className="font-mono text-xs bg-gray-800 p-1 rounded-md text-indigo-400">{persistenceType}</span>
                    </p>
                </div>
                {/* Knoppen Groep */}
                <div className="flex space-x-3">
                    {/* NIEUW: Bewerken Modus Toggle */}
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
            {view === 'board' ? renderSnippetBoard() : <SettingsView persistenceType={persistenceType} setPersistenceType={setPersistenceType} setView={setView} />}

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
