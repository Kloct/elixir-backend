FROM node:current-alpine
COPY . /app/
VOLUME ["/app/certs"]
ENV NODE_ENV production
ENV PORT 443
ENV DB_HOST .
ENV DB_USER .
ENV DB_PASSWORD .
ENV DB_DATABASE .
RUN cd /app/
RUN npm install --only=production
EXPOSE 443
CMD cd /app/ && npm start