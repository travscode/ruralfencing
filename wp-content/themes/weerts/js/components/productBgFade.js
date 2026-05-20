import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

let productBgFade;

export function initProductBgFade() {
  const bg = document.getElementById('product-bg-fade');
  if (!bg) return;

  productBgFade = gsap.to(bg, {
    backgroundColor: 'rgb(246, 246, 246)',
    ease: 'none',
    scrollTrigger: {
      // Start fade at 100vh, end at 200vh (absolute scroll positions)
      start: () => window.innerHeight,
      end: () => window.innerHeight * 2,
      scrub: true,
      invalidateOnRefresh: true,
      id: 'productBgFade',
    },
  });
}

export function killProductBgFade() {
  if (productBgFade && productBgFade.scrollTrigger) {
    productBgFade.scrollTrigger.kill();
    productBgFade.kill();
    productBgFade = null;
  }
}