import srcset from 'srcset';

// import bees style and script for injecting, as raw minimised strings
import beeCss from 'raw-loader!postcss-loader!./assets/bees.css';
import beeJs from 'raw-loader!terser-loader!./assets/bees.js';

class BodyHandler {
	constructor(nonce){
		this.nonce = nonce;
	}
	element(element){
		element.append(`<style>${beeCss}</style><script nonce="${this.nonce}">${beeJs}</script>`, {
			html: true
		});
	}
}

// this handles rewriting of `/cdn-cgi` image src/srcset attributes since these can't be proxied in a worker
const imageResizeRegex = /^\/cdn-cgi\/image\/(?:[A-Za-z]+=[\dA-Za-z]+,?)+\/(.*)/;
class ImageHandler {
	element(element){
		const src = element.getAttribute('src');
		if(src && src.startsWith('/cdn-cgi')){
			const test = imageResizeRegex.exec(src);
			if(test && test[1]){
				element.setAttribute('src', test[1]);
			}
		}

		const srcsetVal = element.getAttribute('srcset');
		if(srcsetVal && srcsetVal.includes('/cdn-cgi')){
			// quick and dirty override for all srcset images. Not a perfect solution, but good enough for this joke
			const updatedImages = srcset.parse(srcsetVal).map((image) => {
				const test = imageResizeRegex.exec(image.url);
				if(test && test[1]){
					image.url = test[1];
				}
				return image;
			});
			element.setAttribute('srcset', srcset.stringify(updatedImages));
		}
	}
}

class MetaHandler {
	element(element){
		// rewrite robots to ensure no indexing
		const type = element.getAttribute('name');
		if(type && type === 'robots'){
			element.setAttribute('content', 'noindex, nofollow');
			return;
		}

		// rewrite share URLs to make sure social links land on the right URL
		const content = element.getAttribute('content');
		if(content && content === 'https://nodecraft.com'){
			element.setAttribute('content', 'https://bees.nodecraft.workers.dev');
		}
	}
}
// paths we're okay to add bees to
const validPaths = [{
	path: '/games',
	exact: false
},
{
	path: '/community',
	exact: false
},
{
	path: '/blog',
	exact: false
},
{
	path: '/support',
	exact: false
},
{
	path: '/about',
	exact: false
},
{
	path: '/',
	exact: true
}];

/* global HTMLRewriter */
async function handleRequest(request){
	const url = new URL(request.url);
	url.host = 'nodecraft.com';
	const nodecraft = await fetch(url);

	// if HTML, check if we should add bees, or redirect away
	if(nodecraft.headers.has('content-type') && nodecraft.headers.get('content-type').includes('text/html')){
		let redirectAway = true;
		for(const path of validPaths){
			if(url.pathname.startsWith(path.path)){
				// in a match, now check if exact
				if(path.exact && url.pathname === path.path){
					redirectAway = false;
					break;
				}
				if(!path.exact){
					redirectAway = false;
				}
			}
		}
		if(redirectAway){
			return Response.redirect(url, 302);
		}
		// get nonce for CSP JS
		const nonce = await (await fetch('https://uuid.rocks/plain')).text();

		// setup htmlrewriter
		// handle our real script injection
		const transformedRaw = new HTMLRewriter().on('body', new BodyHandler(nonce)).transform(nodecraft);
		// rewrite images with resizing urls, since these don't work being proxieed
		const transformedImages = new HTMLRewriter().on('img', new ImageHandler()).transform(transformedRaw);
		// rewrite meta tags
		const transformed = new HTMLRewriter().on('meta', new MetaHandler()).transform(transformedImages);

		// get headers and fix up CSP
		const headers = new Headers(transformed.headers);

		// add our JS nonce for the bees script, and manipulate a few other directives to not break things
		const CSP = headers.get('Content-Security-Policy');
		let newCSP = CSP.replace('script-src', 'script-src \'nonce-' + nonce + '\'');
		newCSP = newCSP.replace('default-src', 'default-src nodecraft.com');
		newCSP = newCSP.replace('img-src', 'img-src nodecraft.com');
		newCSP = newCSP.replace('font-src', 'font-src nodecraft.com');
		headers.set('Content-Security-Policy', newCSP);

		// we really don't want this page indexed
		headers.set('X-Robots-Tag', 'noindex, nofollow');

		return new Response(await transformed.body, {
			headers: headers
		});
	}

	// otherwise pass through requests (JS/CSS assets, etc.)
	return nodecraft;
}

addEventListener('fetch', (event) => {
	event.respondWith(handleRequest(event.request));
});