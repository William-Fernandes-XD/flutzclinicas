FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL
ARG VITE_SITE_URL=https://flutzclinicas.com.br
ARG VITE_APP_NAME=Flutz
ARG VITE_COMPANY_NAME=UpVibe
ARG VITE_COMPANY_URL=https://www.upvibe.blog.br/
ARG VITE_CONTACT_EMAIL=contato@flutzclinicas.com.br
ARG VITE_CONTACT_WHATSAPP=62981451856
ARG VITE_INSTAGRAM_URL=https://www.instagram.com/flutzclinicas/
ARG VITE_DPO_NOME=UpVibe
ARG VITE_DPO_EMAIL=privacy@flutzclinicas.com.br
ARG VITE_PLANO_FLUTZ=R$ 149,90/mês

ENV VITE_API_URL=$VITE_API_URL \
    VITE_SITE_URL=$VITE_SITE_URL \
    VITE_APP_NAME=$VITE_APP_NAME \
    VITE_COMPANY_NAME=$VITE_COMPANY_NAME \
    VITE_COMPANY_URL=$VITE_COMPANY_URL \
    VITE_CONTACT_EMAIL=$VITE_CONTACT_EMAIL \
    VITE_CONTACT_WHATSAPP=$VITE_CONTACT_WHATSAPP \
    VITE_INSTAGRAM_URL=$VITE_INSTAGRAM_URL \
    VITE_DPO_NOME=$VITE_DPO_NOME \
    VITE_DPO_EMAIL=$VITE_DPO_EMAIL \
    VITE_PLANO_FLUTZ=$VITE_PLANO_FLUTZ

RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
