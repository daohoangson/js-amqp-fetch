ARG BASE_IMAGE=node:lts-alpine

FROM $BASE_IMAGE as builder
COPY package*.json /amqp-fetch/
WORKDIR /amqp-fetch
RUN npm ci
COPY . /amqp-fetch
RUN npm run build

FROM $BASE_IMAGE
COPY --from=builder /amqp-fetch/dist /amqp-fetch/dist
WORKDIR /amqp-fetch

CMD node dist/index.js
