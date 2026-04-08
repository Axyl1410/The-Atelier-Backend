import { ApiException, contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "@/types";

const profileResponse = contentJson(
  z.object({
    success: z.literal(true),
    user: z
      .object({
        id: z.string(),
      })
      .passthrough(),
  })
);

const apiErrorResponse = contentJson(
  z.object({
    message: z.string(),
    code: z.union([z.string(), z.number()]).optional(),
  })
);

function throwUnauthorized(): never {
  const err = new ApiException("Unauthorized");
  err.status = 401;
  err.code = 7010;
  throw err;
}

export class GetProfileEndpoint extends OpenAPIRoute {
  schema = {
    tags: ["Profile"],
    summary: "Get current profile from Better Auth session",
    responses: {
      "200": {
        description: "Current user profile",
        ...profileResponse,
      },
      "401": {
        description: "Not authenticated",
        ...apiErrorResponse,
      },
    },
  };

  handle(c: AppContext) {
    const user = c.get("user");
    if (!user) {
      throwUnauthorized();
    }

    return {
      success: true as const,
      user,
    };
  }
}
