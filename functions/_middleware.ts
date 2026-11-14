// Every request outside the static assets passes through here first: pages get
// their real content in the HTML (or as Markdown, for agents that ask), unknown
// paths get a real 404, and /api requests carry on to the API function.
import { withSecurityHeaders } from '../server/headers'
import { handleSite, type SiteEnv } from '../server/site'

export const onRequest: PagesFunction<SiteEnv> = async ({ request, env, next }) => {
  const response = withSecurityHeaders(await handleSite(request, env, () => next()))
  return request.method === 'HEAD' ? new Response(null, response) : response
}
