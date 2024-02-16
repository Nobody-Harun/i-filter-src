const REDIRECT_TIMES = 3;

var bg = chrome.extension.getBackgroundPage();

function setReloadFunctions(){
    let url = new URL(location.href);
    let dst = decodeURIComponent(atob(url.searchParams.get('param')));

    if(dst in bg.redirectLog){
        let redirectTime = Number(bg.redirectLog[dst]);
        if(redirectTime && redirectTime <= REDIRECT_TIMES){
            setTimeout(()=>{
                location.href = dst;
            }, 3000);
        } else {
            delete bg.redirectLog[dst];
        }
    }
}

document.addEventListener("DOMContentLoaded", setReloadFunctions);