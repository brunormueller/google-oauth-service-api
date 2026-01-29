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
    //   - Dev:  https://linksun.inf.br/back-end-others/index.php
    linksunBackendUrl: process.env.LINKSUN_BACKEND_URL || "https://linksun.inf.br/back-end/index.php",
    linksunBackendUrlHom: process.env.LINKSUN_BACKEND_URL_HOM || "https://linksun.inf.br/back-end-hom/index.php",
    linksunBackendUrlDev: "http://localhost:8000/index.php"
};
