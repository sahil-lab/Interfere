FROM nginxinc/nginx-unprivileged:stable-alpine
COPY infra/docker/nginx.conf /etc/nginx/nginx.conf
COPY apps/web/dist /usr/share/nginx/html
USER 101:101
EXPOSE 8080
ENTRYPOINT ["nginx", "-g", "daemon off;"]
