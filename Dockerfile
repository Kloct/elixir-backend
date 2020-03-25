FROM node:current-alpine
COPY . /app/
VOLUME ["/app/certs"]
ENV NODE_ENV production
ENV PORT 443
ENV DB_HOST .
ENV DB_USER .
ENV DB_PASSWORD .
ENV DB_DATABASE .
RUN npm install --only=production
CMD npm start