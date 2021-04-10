'use strict';
/* global chrome */

(() => {

// Script should only run once
if (hasProperty(window, "tabPause")) return

var tabPause = false;
var Elements = new Set();

chrome.runtime.onMessage.addListener(message => {
  switch (message) {
    case 'toggleFastPlayback':
      toggleRate();
      break
    case 'togglePlayback':
      togglePlayback();
      break
    case 'allowplayback':
      resume(false);
      break
    case 'next':
      next();
      break
    case 'previous':
      previous();
      break
    case 'pause':
      pause();
      break
    case 'play':
	  // When there media already playing tell the background script.
	  if (isPlaying()) chrome.runtime.sendMessage('play');
      resume(true);
      break
  }
});

function hasProperty(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function togglePlayback() {
    Elements.forEach(e => {
    if (e.paused) return;
    if (e.togglePause) {
	  e.togglePause = false;
      e.playbackRate = e.wasPlaybackRate;
    } else {
      e.togglePause = true;
	  e.wasPlaying = false;
      e.wasPlaybackRate = e.playbackRate;
      e.playbackRate = 0;
    }
  });
}

function isPlaying() {
	const audibleElements = [...Elements].filter(e => !e.muted);
    return (audibleElements.length !== 0);
}

function isPaused(e) {
	return (e.paused || e.playbackRate === 0);
}

function next() {
  Elements.forEach(e => {
    if (isPaused(e)) return;
    e.currentTime = e.duration;
  });
}

function previous() {
  Elements.forEach(e => {
    if (isPaused(e)) return;
    // Unknown
    e.currentTime = 0;
  });
}

// Controlled by global fast forward shortcut
function toggleRate() {
  Elements.forEach(e => {
    if (isPaused(e)) return;
    if (e.wasPlaybackRate && e.playbackRate > 1) {
      e.playbackRate = e.wasPlaybackRate;
    } else {
      e.wasPlaybackRate = e.playbackRate;
      e.playbackRate = 2;
    }
  });
}

function injectScript(filePath) {
  var script = document.createElement('script');
  script.setAttribute('type', 'text/javascript');
  script.setAttribute('crossorigin', 'anonymous');
  script.setAttribute('src', chrome.runtime.getURL(filePath));
  document.head.appendChild(script);
}

function onPlay(e) {
	if (isPaused(e)) return;
    if (e.muted) {
      chrome.runtime.sendMessage('playMuted');
    } else {
      chrome.runtime.sendMessage('play');
    }
}

window.addEventListener('DOMContentLoaded', () => {
  // Adds content to DOM needed because of isolation
  injectScript('WindowScript.js');
}, { passive: true });

window.addEventListener('pagehide', () => {
  chrome.runtime.sendMessage('pause');
}, { passive: true });

// On media play event
window.addEventListener('play', function(event) {
  const src = event.srcElement;
  if (src instanceof HTMLMediaElement) {
    onPlay(src);
    if (tabPause) pauseElement(src);
    Elements.add(src);
  }
}, { capture: true, passive: true });

window.addEventListener('volumechange', function(event) {
  const src = event.srcElement;
  if (src instanceof HTMLMediaElement) {
	onPlay(src);
  }
}, { capture: true, passive: true });

window.addEventListener('pause', event => {
  setTimeout(() => {
    onPause(event);
  }, 200);
}, { capture: true, passive: true });

window.addEventListener('abort', event => {
  onPause(event);
}, { capture: true, passive: true });

function onPause(event) {
  const src = event.srcElement;
  if (src instanceof HTMLMediaElement && src.paused) {
	// Check if all elements have paused.
    Elements.delete(src);
    if (!isPlaying()) chrome.runtime.sendMessage('pause');
  }
}

// Dont tell the media please
window.addEventListener('ratechange', function(event) {
  const src = event.srcElement;
  if (src instanceof HTMLMediaElement) {
    if (src.playbackRate === 0 && tabPause && src.wasPlaying) {
      event.stopPropagation();
    }
	if (src.playbackRate !== 0) {
		onPlay(src);
	}
  }
}, { capture: true });

function pauseElement(e) {
  // If media attempts to play when it should be paused dont change its old values.
  if (!e.wasPlaying) {
    e.wasVolume = e.volume;
    e.wasPlaybackRate = e.playbackRate;
  }
  e.playbackRate = 0;
  e.volume = 0;
  e.wasPlaying = true;
}

async function pause() {
  tabPause = true;
  Elements.forEach(e => {
	if (isPaused(e)) return;
    pauseElement(e);
  });
}

async function resume(shouldPlay) {
  tabPause = false;
  Elements.forEach(e => {
    if (!document.contains(e)) {
      Elements.delete(e);
      return
    }
    if (!e.wasPlaying) return
    // Pause foreground media normaly
    if (shouldPlay === false) e.pause();
    e.volume = e.wasVolume;
    e.playbackRate = e.wasPlaybackRate;
    e.wasPlaying = false;
  });
}

// End of code
})();
