# -------------------------------------------------------------------
# STAGE 1: Build de React Applicatie
# Gebruik Node.js om de React app te bouwen.
# -------------------------------------------------------------------
FROM node:20-alpine as builder

WORKDIR /app

# Kopieer package.json en installeer afhankelijkheden
COPY package.json .
RUN npm install

# Kopieer de rest van de bestanden en voer de productie-build uit
COPY . .
RUN npm run build

# -------------------------------------------------------------------
# STAGE 2: Serve de Applicatie met Nginx (Enkel Proces)
# Gebruik een lichte Nginx image om de statische bestanden te serveren.
# -------------------------------------------------------------------
FROM nginx:stable-alpine

# Kopieer de basis Nginx configuratie 
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Kopieer de gebouwde React app van de 'builder' stage naar de Nginx webroot.
COPY --from=builder /app/build /usr/share/nginx/html

# Expose poort 80 (standaard HTTP)
EXPOSE 80

# Nginx wordt gestart met dit commando, het is het enige proces in de container
CMD ["nginx", "-g", "daemon off;"]
