FROM --platform=linux/amd64 node:20.11-alpine3.19

RUN apk update && apk upgrade && apk add --no-cache git

WORKDIR /usr/server

COPY . .

RUN npm install

ENV PORT=8080
EXPOSE 8080

CMD [ "node", "src/server" ]