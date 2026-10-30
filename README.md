# SIGA Shop

Catálogo digital público para `https://sigashop.omisoltec.mx`.

## Publicación

Este proyecto es un sitio estático. Puede publicarse directamente en Nginx o Apache; no requiere Node.js ni un proceso de aplicación en producción.

```bash
sudo mkdir -p /var/www/siga/ecommerce
sudo git clone https://github.com/bcssystems/sigaEcommerce.git /var/www/siga/ecommerce
```

El frontend consume el API público de SIGA en el mismo dominio:

```text
https://sigashop.omisoltec.mx/api/v1
```

El backend debe permitir `https://sigashop.omisoltec.mx` en CORS.

## Nginx

El `root` debe apuntar directamente a la carpeta del repositorio y la ruta `/` debe usar `index.html`. Se recomienda agregar HTTPS con Certbot.

## WhatsApp

El botón de compra abre WhatsApp con el número `+52 1 56 3486 1468` y el mensaje:

```text
Hola, me interesa este producto, NOMBRE_DEL_PRODUCTO
```
