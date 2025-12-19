# Gebruik de officiële Nginx image als basis
FROM nginx:stable-alpine

# Verwijder de standaard Nginx configuratie
RUN rm /etc/nginx/conf.d/default.conf

# Kopieer onze Nginx configuratie
COPY nginx.conf /etc/nginx/conf.d/

# Kopieer de HTML (Frontend) bestanden naar de Nginx webroot
# Alleen de index.html is nodig
COPY *.* /usr/share/nginx/html/

# Nginx draait standaard op poort 80
EXPOSE 80

# De container blijft draaien met Nginx
CMD ["nginx", "-g", "daemon off;"]
