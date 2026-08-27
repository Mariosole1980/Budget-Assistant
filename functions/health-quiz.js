export async function onRequest(context) {
  const url = new URL(context.request.url);
  return context.env.ASSETS.fetch(new URL('/health-quiz.html', url));
}
