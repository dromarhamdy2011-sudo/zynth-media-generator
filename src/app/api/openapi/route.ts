import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/zynth/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/openapi — مواصفة OpenAPI 3.1 جاهزة للاستيراد مباشرة
 * في ChatGPT (GPT Builder → Actions → Import from URL).
 * المصادقة: ترويسة x-api-key بقيمة ZYNTH_API_KEY.
 */
export async function GET(req: Request) {
  const baseUrl = getBaseUrl(req);

  const apiKeySecurity = [{ ApiKeyAuth: [] }];

  const spec = {
    openapi: "3.1.0",
    info: {
      title: "Zynth AI — Surreal Media Generator",
      description:
        "Generate surreal images and videos, merge them, and schedule social media posts via Metricool. " +
        "Typical flow: generate an image or video → (optional) merge several assets → publish/schedule with /api/publish. " +
        "Media becomes available at the returned `url` once `status` is `completed`.",
      version: "1.0.0",
    },
    servers: [{ url: baseUrl }],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
          description: "API key (ZYNTH_API_KEY)",
        },
      },
      schemas: {
        Media: {
          type: "object",
          properties: {
            id: { type: "string", description: "Unique media id" },
            type: {
              type: "string",
              enum: ["image", "video", "merged_image", "merged_video"],
            },
            status: { type: "string", enum: ["processing", "completed", "failed"] },
            prompt: { type: "string" },
            mimeType: { type: "string" },
            size: { type: "integer" },
            url: { type: "string", description: "Public file URL when completed" },
            error: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Publication: {
          type: "object",
          properties: {
            id: { type: "string" },
            mediaId: { type: "string" },
            networks: { type: "array", items: { type: "string" } },
            caption: { type: "string" },
            status: { type: "string", enum: ["scheduled", "failed"] },
            scheduledAt: { type: "string", format: "date-time" },
            providerRef: { type: "string" },
          },
        },
      },
    },
    paths: {
      "/api/generate/image": {
        post: {
          operationId: "generateImage",
          summary: "Generate surreal image(s) from a text prompt",
          security: apiKeySecurity,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["prompt"],
                  properties: {
                    prompt: { type: "string", description: "Detailed surreal image description" },
                    size: {
                      type: "string",
                      enum: ["square", "portrait", "landscape", "wide"],
                      description: "Aspect ratio preset (default square)",
                    },
                    count: { type: "integer", minimum: 1, maximum: 4 },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Generated media (status completed or failed per item)",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      media: { type: "array", items: { $ref: "#/components/schemas/Media" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/generate/video": {
        post: {
          operationId: "generateVideo",
          summary: "Start async surreal video generation (poll until completed)",
          security: apiKeySecurity,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["prompt"],
                  properties: {
                    prompt: { type: "string", description: "Detailed surreal video description" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Created media record (status=processing)",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { media: { $ref: "#/components/schemas/Media" } },
                  },
                },
              },
            },
          },
        },
      },
      "/api/media": {
        get: {
          operationId: "listMedia",
          summary: "List generated media (newest first)",
          security: apiKeySecurity,
          parameters: [
            { name: "limit", in: "query", schema: { type: "integer", maximum: 120 } },
            { name: "types", in: "query", schema: { type: "string" }, description: "Comma separated: image,video,merged_image,merged_video" },
          ],
          responses: {
            "200": {
              description: "Media list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      media: { type: "array", items: { $ref: "#/components/schemas/Media" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/media/{id}": {
        get: {
          operationId: "getMedia",
          summary: "Get one media record (syncs pending video jobs)",
          security: apiKeySecurity,
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Media record",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { media: { $ref: "#/components/schemas/Media" } },
                  },
                },
              },
            },
            "404": { description: "Not found" },
          },
        },
        delete: {
          operationId: "deleteMedia",
          summary: "Delete a media record and its file",
          security: apiKeySecurity,
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { "200": { description: "Deleted" } },
        },
      },
      "/api/merge/images": {
        post: {
          operationId: "mergeImages",
          summary: "Merge 2-9 completed images into one collage",
          security: apiKeySecurity,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["ids"],
                  properties: {
                    ids: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 9 },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Merged media record",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { media: { $ref: "#/components/schemas/Media" } },
                  },
                },
              },
            },
          },
        },
      },
      "/api/merge/videos": {
        post: {
          operationId: "mergeVideos",
          summary: "Concatenate 2-6 completed videos into one clip",
          security: apiKeySecurity,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["ids"],
                  properties: {
                    ids: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 6 },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Merged media record",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { media: { $ref: "#/components/schemas/Media" } },
                  },
                },
              },
            },
          },
        },
      },
      "/api/publish": {
        post: {
          operationId: "publishMedia",
          summary: "Schedule/publish a media asset to social networks via Metricool",
          security: apiKeySecurity,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["mediaId", "networks", "caption"],
                  properties: {
                    mediaId: { type: "string", description: "Completed media id" },
                    networks: {
                      type: "array",
                      items: {
                        type: "string",
                        enum: ["instagram", "facebook", "tiktok", "twitter", "youtube", "linkedin", "pinterest", "threads", "bluesky"],
                      },
                    },
                    caption: { type: "string" },
                    scheduledAt: { type: "string", format: "date-time", description: "Omit to publish now" },
                    timezone: { type: "string", description: "IANA timezone, e.g. Asia/Riyadh" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Publication record",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { publication: { $ref: "#/components/schemas/Publication" } },
                  },
                },
              },
            },
          },
        },
      },
      "/api/publications": {
        get: {
          operationId: "listPublications",
          summary: "List publication/scheduling history",
          security: apiKeySecurity,
          responses: {
            "200": {
              description: "Publications list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      publications: { type: "array", items: { $ref: "#/components/schemas/Publication" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/health": {
        get: {
          operationId: "healthCheck",
          summary: "Service health and enabled features",
          responses: { "200": { description: "Health status" } },
        },
      },
    },
  };

  return NextResponse.json(spec, {
    headers: { "Cache-Control": "no-store" },
  });
}
