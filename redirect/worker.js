// Serves www.kronosdb.com: every request is redirected to the same path on kronosdb.com.
export default {
  fetch(request) {
    const url = new URL(request.url)
    url.hostname = "kronosdb.com"
    return Response.redirect(url.toString(), 301)
  },
}
