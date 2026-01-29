import swaggerJsdoc from "swagger-jsdoc";

const swaggerDefinition = {
  openapi: "3.0.1",
  info: {
    title: "Google Auth Service API",
    version: "1.0.0",
    description:
      "API documentation for the Google authentication service used to initiate OAuth flows and manage Google access tokens.",
  },
  servers: [
    {
      url: "http://localhost:4000",
      description: "Local development server",
    },
  ],
  tags: [
    {
      name: "auth",
      description: "Authentication and token management endpoints",
    },
  ],
  paths: {
    "/auth/google": {
      get: {
        tags: ["auth"],
        summary: "Start Google OAuth flow",
        description:
          "Redirects the user to Google to approve the requested scopes. This endpoint should be opened in a browser window or popup.",
        responses: {
          302: {
            description:
              "Redirects the client to Google's OAuth consent screen.",
          },
        },
      },
    },
    "/auth/google/callback": {
      get: {
        tags: ["auth"],
        summary: "Handle Google OAuth callback",
        description:
          "Completes the Google OAuth flow and posts the authenticated user data back to the opener window.",
        responses: {
          200: {
            description: "HTML page that posts a message to the opener window.",
            content: {
              "text/html": {
                schema: {
                  type: "string",
                  description: "HTML snippet rendered to the user.",
                },
              },
            },
          },
          401: {
            description: "Authentication failed; the user is redirected home.",
          },
        },
      },
    },
    "/auth/refresh-token": {
      post: {
        tags: ["auth"],
        summary: "Exchange refresh token for a new access token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["refreshToken"],
                properties: {
                  refreshToken: {
                    type: "string",
                    description: "Refresh token issued by Google.",
                    example: "1//0gabcdefExampleRefreshToken",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Returns a new access token.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    accessToken: {
                      type: "string",
                      description: "Newly issued Google access token.",
                      example: "ya29.a0AfExampleAccessToken",
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "Refresh token is missing from the request.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      example: "refreshToken é obrigatório",
                    },
                  },
                },
              },
            },
          },
          500: {
            description: "Unexpected error when obtaining a new access token.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      example: "Erro ao renovar token",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/auth/logout": {
      get: {
        tags: ["auth"],
        summary: "Terminates the session and redirects the user",
        responses: {
          302: {
            description: "Redirects the user to the configured frontend URL.",
          },
        },
      },
    },
  },
};

const swaggerOptions = {
  definition: swaggerDefinition,
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);
