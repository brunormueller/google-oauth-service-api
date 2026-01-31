import dotenv from "dotenv";
dotenv.config();

export const config = {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    sessionSecret: process.env.SESSION_SECRET,
    frontendURL: process.env.FRONTEND_URL,
    // URL do backend PHP Linksun
    // Opções: 
    //   - Prod: https://linksun.inf.br/back-end/index.php
    //   - Hom:  https://linksun.inf.br/back-end-hom/index.php
    //   - Dev:  http://host.docker.internal:8000/index.php (para Docker no Windows/Mac)
    //          ou http://localhost:8000/index.php (se rodando localmente sem Docker)
    linksunBackendUrl: process.env.LINKSUN_BACKEND_URL || "https://linksun.inf.br/back-end/index.php",
    linksunBackendUrlHom: process.env.LINKSUN_BACKEND_URL_HOM || "https://linksun.inf.br/back-end-hom/index.php",
    linksunBackendUrlDev: process.env.LINKSUN_BACKEND_URL_DEV || "http://host.docker.internal:8000/NovoLinksun/back-end/index.php"
};
