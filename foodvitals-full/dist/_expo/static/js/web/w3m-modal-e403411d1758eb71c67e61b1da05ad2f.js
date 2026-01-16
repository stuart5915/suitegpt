__d(function(g,r,i,a,m,e,d){"use strict";Object.defineProperty(e,'__esModule',{value:!0});var t=r(d[0]);Object.keys(t).forEach(function(n){'default'===n||Object.prototype.hasOwnProperty.call(e,n)||Object.defineProperty(e,n,{enumerable:!0,get:function(){return t[n]}})})},2783,[2784]);
__d(function(g,_r,_i,a,m,_e,_d){"use strict";Object.defineProperty(_e,'__esModule',{value:!0}),Object.defineProperty(_e,"W3mModal",{enumerable:!0,get:function(){return c}});var e,t=_r(_d[0]),o=_r(_d[1]),n=_r(_d[2]),s=_r(_d[3]),i=_r(_d[4]),r=(e=i)&&e.__esModule?e:{default:e},l=this&&this.__decorate||function(e,t,o,n){var s,i=arguments.length,r=i<3?t:null===n?n=Object.getOwnPropertyDescriptor(t,o):n;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)r=Reflect.decorate(e,t,o,n);else for(var l=e.length-1;l>=0;l--)(s=e[l])&&(r=(i<3?s(r):i>3?s(t,o,r):s(t,o))||r);return i>3&&r&&Object.defineProperty(t,o,r),r};const d='scroll-lock';let c=class extends n.LitElement{constructor(){super(),this.unsubscribe=[],this.abortController=void 0,this.open=t.ModalController.state.open,this.caipAddress=t.AccountController.state.caipAddress,this.isSiweEnabled=t.OptionsController.state.isSiweEnabled,this.connected=t.AccountController.state.isConnected,this.loading=t.ModalController.state.loading,this.shake=t.ModalController.state.shake,this.initializeTheming(),t.ApiController.prefetch(),this.unsubscribe.push(t.ModalController.subscribeKey('open',e=>e?this.onOpen():this.onClose()),t.ModalController.subscribeKey('shake',e=>this.shake=e),t.ModalController.subscribeKey('loading',e=>{this.loading=e,this.onNewAddress(t.AccountController.state.caipAddress)}),t.AccountController.subscribeKey('isConnected',e=>this.connected=e),t.AccountController.subscribeKey('caipAddress',e=>this.onNewAddress(e)),t.OptionsController.subscribeKey('isSiweEnabled',e=>this.isSiweEnabled=e)),t.EventsController.sendEvent({type:'track',event:'MODAL_LOADED'})}disconnectedCallback(){this.unsubscribe.forEach(e=>e()),this.onRemoveKeyboardListener()}render(){return this.open?n.html`
          <wui-flex @click=${this.onOverlayClick.bind(this)} data-testid="w3m-modal-overlay">
            <wui-card
              shake="${this.shake}"
              role="alertdialog"
              aria-modal="true"
              tabindex="0"
              data-testid="w3m-modal-card"
            >
              <w3m-header></w3m-header>
              <w3m-router></w3m-router>
              <w3m-snackbar></w3m-snackbar>
            </wui-card>
          </wui-flex>
          <w3m-tooltip></w3m-tooltip>
        `:null}async onOverlayClick(e){e.target===e.currentTarget&&await this.handleClose()}async handleClose(){const e='ConnectingSiwe'===t.RouterController.state.view,o='ApproveTransaction'===t.RouterController.state.view;if(this.isSiweEnabled){const{SIWEController:n}=await _r(_d[6])(_d[5],_d.paths);'success'!==n.state.status&&(e||o)?t.ModalController.shake():t.ModalController.close()}else t.ModalController.close()}initializeTheming(){const{themeVariables:e,themeMode:n}=t.ThemeController.state,s=o.UiHelperUtil.getColorTheme(n);(0,o.initializeTheming)(e,s)}onClose(){this.open=!1,this.classList.remove('open'),this.onScrollUnlock(),t.SnackController.hide(),this.onRemoveKeyboardListener()}onOpen(){this.open=!0,this.classList.add('open'),this.onScrollLock(),this.onAddKeyboardListener()}onScrollLock(){const e=document.createElement('style');e.dataset.w3m=d,e.textContent="\n      body {\n        touch-action: none;\n        overflow: hidden;\n        overscroll-behavior: contain;\n      }\n      w3m-modal {\n        pointer-events: auto;\n      }\n    ",document.head.appendChild(e)}onScrollUnlock(){const e=document.head.querySelector(`style[data-w3m="${d}"]`);e&&e.remove()}onAddKeyboardListener(){this.abortController=new AbortController;const e=this.shadowRoot?.querySelector('wui-card');e?.focus(),window.addEventListener('keydown',t=>{if('Escape'===t.key)this.handleClose();else if('Tab'===t.key){const{tagName:o}=t.target;!o||o.includes('W3M-')||o.includes('WUI-')||e?.focus()}},this.abortController)}onRemoveKeyboardListener(){this.abortController?.abort(),this.abortController=void 0}async onNewAddress(e){if(!this.connected||this.loading)return;const o=t.CoreHelperUtil.getPlainAddress(this.caipAddress),n=t.CoreHelperUtil.getPlainAddress(e),s=t.CoreHelperUtil.getNetworkId(this.caipAddress),i=t.CoreHelperUtil.getNetworkId(e);if(this.caipAddress=e,this.isSiweEnabled){const{SIWEController:e}=await _r(_d[6])(_d[5],_d.paths),t=await e.getSession();if(t&&o&&n&&o!==n)return void(e.state._client?.options.signOutOnAccountChange&&(await e.signOut(),this.onSiweNavigation()));if(t&&s&&i&&s!==i)return void(e.state._client?.options.signOutOnNetworkChange&&(await e.signOut(),this.onSiweNavigation()));this.onSiweNavigation()}}onSiweNavigation(){this.open?t.RouterController.push('ConnectingSiwe'):t.ModalController.open({view:'ConnectingSiwe'})}};c.styles=r.default,l([(0,s.state)()],c.prototype,"open",void 0),l([(0,s.state)()],c.prototype,"caipAddress",void 0),l([(0,s.state)()],c.prototype,"isSiweEnabled",void 0),l([(0,s.state)()],c.prototype,"connected",void 0),l([(0,s.state)()],c.prototype,"loading",void 0),l([(0,s.state)()],c.prototype,"shake",void 0),c=l([(0,o.customElement)('w3m-modal')],c)},2784,{"0":2203,"1":2305,"2":2785,"3":2791,"4":2802,"5":2649,"6":1718,"paths":{"2649":"/_expo/static/js/web/index-46bcd172ab79d12ce4921e198eb5a77e.js"}});
__d(function(g,r,i,a,m,e,d){"use strict";Object.defineProperty(e,'__esModule',{value:!0}),Object.defineProperty(e,"default",{enumerable:!0,get:function(){return t}});var t=r(d[0]).css`
  :host {
    z-index: var(--w3m-z-index);
    display: block;
    backface-visibility: hidden;
    will-change: opacity;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    opacity: 0;
    background-color: var(--wui-cover);
    transition: opacity 0.2s var(--wui-ease-out-power-2);
    will-change: opacity;
  }

  :host(.open) {
    opacity: 1;
  }

  wui-card {
    max-width: var(--w3m-modal-width);
    width: 100%;
    position: relative;
    animation: zoom-in 0.2s var(--wui-ease-out-power-2);
    animation-fill-mode: backwards;
    outline: none;
  }

  wui-card[shake='true'] {
    animation:
      zoom-in 0.2s var(--wui-ease-out-power-2),
      w3m-shake 0.5s var(--wui-ease-out-power-2);
  }

  wui-flex {
    overflow-x: hidden;
    overflow-y: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  @media (max-height: 700px) and (min-width: 431px) {
    wui-flex {
      align-items: flex-start;
    }

    wui-card {
      margin: var(--wui-spacing-xxl) 0px;
    }
  }

  @media (max-width: 430px) {
    wui-flex {
      align-items: flex-end;
    }

    wui-card {
      max-width: 100%;
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
      border-bottom: none;
      animation: slide-in 0.2s var(--wui-ease-out-power-2);
    }

    wui-card[shake='true'] {
      animation:
        slide-in 0.2s var(--wui-ease-out-power-2),
        w3m-shake 0.5s var(--wui-ease-out-power-2);
    }
  }

  @keyframes zoom-in {
    0% {
      transform: scale(0.95) translateY(0);
    }
    100% {
      transform: scale(1) translateY(0);
    }
  }

  @keyframes slide-in {
    0% {
      transform: scale(1) translateY(50px);
    }
    100% {
      transform: scale(1) translateY(0);
    }
  }

  @keyframes w3m-shake {
    0% {
      transform: scale(1) rotate(0deg);
    }
    20% {
      transform: scale(1) rotate(-1deg);
    }
    40% {
      transform: scale(1) rotate(1.5deg);
    }
    60% {
      transform: scale(1) rotate(-1.5deg);
    }
    80% {
      transform: scale(1) rotate(1deg);
    }
    100% {
      transform: scale(1) rotate(0deg);
    }
  }

  @keyframes w3m-view-height {
    from {
      height: var(--prev-height);
    }
    to {
      height: var(--new-height);
    }
  }
`},2802,[2785]);