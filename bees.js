const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

const viewportHeight = document.body.clientHeight;
const viewportWidth = document.body.clientWidth;

const fragment = document.createDocumentFragment();
const container = document.createElement('div');
container.className = 'bees';
fragment.append(container);

const beesNum = Math.floor(viewportHeight / 12);
for(let i = 0; i < beesNum; i++){
	const img = document.createElement('img');
	img.src = 'https://nodecraft.com/assets/images/sales/spring-2021/icon.svg';
	img.height = '50';
	img.width = '50';
	img.classList.add('bee');
	img.style.top = String(Math.floor(Math.random() * viewportHeight)) + 'px';
	img.style.left = String(randomBetween(100, viewportWidth - 100)) + 'px';
	img.style.height = String(Math.floor(randomBetween(20, 50))) + 'px';

	// every 8 or so, animate
	if(i % 8 === 0){
		img.classList.add('bee-animated');
		img.style['animation-delay'] = String(Math.floor(Math.random() * 11)) + 's';
	}else{
		img.style.transform = 'rotate(' + randomBetween(180, 360) + 'deg)';
	}

	// every 18 or so, use a shifted color
	if(i % 18 === 0){
		img.style.filter = 'hue-rotate(' + randomBetween(0, 360) + 'deg)';
	}
	container.append(img);
}

document.body.append(fragment);