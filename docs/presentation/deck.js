// Slide navigation: arrow keys, Page Up/Down, Home/End, space, the buttons, and #slide-N in the address.
// Each change is announced, so the deck works with a screen reader.
const slides = Array.from(document.querySelectorAll('.slide'))
const deck = document.querySelector('.deck')
const counter = document.getElementById('counter')
const announce = document.getElementById('announce')
const progress = document.querySelector('.progress')
let current = 0

function fit() {
  const scale = Math.min(window.innerWidth / 1280, (window.innerHeight - 70) / 720)
  deck.style.transform = `scale(${Math.max(scale, 0.2)})`
}

function show(index, speak = true) {
  current = Math.max(0, Math.min(slides.length - 1, index))
  slides.forEach((slide, i) => {
    const on = i === current
    slide.classList.toggle('current', on)
    slide.setAttribute('aria-hidden', String(!on))
    slide.inert = !on
  })
  counter.textContent = `${current + 1} / ${slides.length}`
  progress.style.width = `${((current + 1) / slides.length) * 100}%`
  history.replaceState(null, '', `#slide-${current + 1}`)
  if (speak) {
    const title = slides[current].querySelector('h1, h2').textContent
    announce.textContent = `Slide ${current + 1} of ${slides.length}: ${title}`
  }
}

document.getElementById('prev').addEventListener('click', () => show(current - 1))
document.getElementById('next').addEventListener('click', () => show(current + 1))
document.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLVideoElement || event.altKey || event.ctrlKey || event.metaKey) return
  const moves = { ArrowRight: 1, ArrowDown: 1, PageDown: 1, ' ': 1, ArrowLeft: -1, ArrowUp: -1, PageUp: -1 }
  if (event.key in moves) show(current + moves[event.key])
  else if (event.key === 'Home') show(0)
  else if (event.key === 'End') show(slides.length - 1)
  else return
  event.preventDefault()
})
window.addEventListener('resize', fit)

const fromAddress = () => Number(/^#slide-(\d+)$/.exec(location.hash)?.[1] ?? 1) - 1
window.addEventListener('hashchange', () => fromAddress() !== current && show(fromAddress()))
fit()
show(fromAddress(), false)
