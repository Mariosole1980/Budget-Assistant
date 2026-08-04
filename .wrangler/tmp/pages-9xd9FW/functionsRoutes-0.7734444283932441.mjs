import { onRequestOptions as __api_ai_js_onRequestOptions } from "C:\\Users\\mario\\Desktop\\money-manager\\functions\\api\\ai.js"
import { onRequestPost as __api_ai_js_onRequestPost } from "C:\\Users\\mario\\Desktop\\money-manager\\functions\\api\\ai.js"
import { onRequestOptions as __api_coach_js_onRequestOptions } from "C:\\Users\\mario\\Desktop\\money-manager\\functions\\api\\coach.js"
import { onRequestPost as __api_coach_js_onRequestPost } from "C:\\Users\\mario\\Desktop\\money-manager\\functions\\api\\coach.js"
import { onRequestOptions as __api_delete_account_js_onRequestOptions } from "C:\\Users\\mario\\Desktop\\money-manager\\functions\\api\\delete-account.js"
import { onRequestPost as __api_delete_account_js_onRequestPost } from "C:\\Users\\mario\\Desktop\\money-manager\\functions\\api\\delete-account.js"

export const routes = [
    {
      routePath: "/api/ai",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_ai_js_onRequestOptions],
    },
  {
      routePath: "/api/ai",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_ai_js_onRequestPost],
    },
  {
      routePath: "/api/coach",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_coach_js_onRequestOptions],
    },
  {
      routePath: "/api/coach",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_coach_js_onRequestPost],
    },
  {
      routePath: "/api/delete-account",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_delete_account_js_onRequestOptions],
    },
  {
      routePath: "/api/delete-account",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_delete_account_js_onRequestPost],
    },
  ]