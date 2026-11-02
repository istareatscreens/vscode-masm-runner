import React, { useEffect, useRef, useState } from "react";
import masmwatch from "../../../images/masmwatch.png";

/*
Modified from https://codepen.io/duptitung
https://codepen.io/duptitung/pen/XMVNyZ
*/
// The composition (_loading-screen.scss) is the original artwork at its designed
// size; when the cmd iframe cannot hold it, the WHOLE group is scaled by one factor
// (transform: scale) so every offset stays proportional - it is never re-laid out.
// DESIGN_W/H = the group's visible bounds at 1x, plus room for a second stage-text line.
const DESIGN_W = 212;
const DESIGN_H = 280;
// the composition is shown whole, once the artwork has decoded and its font has loaded (at
// most READY_MS: a font that never loads does not hide the screen)
const READY_MS = 2000;
const LoadingScreen = () => {
    const [stage, setStage] = useState(() => (typeof window !== "undefined" && window.BW_BOOT_STAGE) || "Loading emulator");
    const [ready, setReady] = useState(false);
    const screenRef = useRef(null);
    const groupRef = useRef(null);
    useEffect(() => {
        let done = false;
        const show = () => { if (!done) { done = true; setReady(true); } };
        const image = new Image();
        const decoded = new Promise((resolve) => { image.onload = resolve; image.onerror = resolve; })
            .then(() => (image.decode ? image.decode().catch(() => {}) : undefined));
        image.src = masmwatch;
        const font = document.fonts && document.fonts.load ? document.fonts.load('1em "Press Start"').catch(() => {}) : Promise.resolve();
        Promise.all([decoded, font]).then(show, show);
        const cap = setTimeout(show, READY_MS);
        return () => { done = true; clearTimeout(cap); };
    }, []);
    useEffect(() => {
        const onStage = (e) => setStage(String(e.detail || ""));
        window.addEventListener("bw-boot-stage", onStage);
        return () => window.removeEventListener("bw-boot-stage", onStage);
    }, []);
    useEffect(() => {
        const screen = screenRef.current, group = groupRef.current;
        if (!screen || !group) return undefined;
        const fit = () => {
            const k = Math.min(1, screen.clientWidth / DESIGN_W, screen.clientHeight / DESIGN_H);
            group.style.transform = k < 1 ? `scale(${k.toFixed(4)})` : "";
        };
        fit();
        if (typeof ResizeObserver !== "undefined") {
            const ro = new ResizeObserver(fit);
            ro.observe(screen);
            return () => ro.disconnect();
        }
        window.addEventListener("resize", fit);
        return () => window.removeEventListener("resize", fit);
    }, [ready]);
    return (
        <div className="loading-screen" ref={screenRef}>
            {ready && (<div className="loading" ref={groupRef}>
                <div className="loading__logo">
                    <div className="logo">
                        <img className="logo__image" src={masmwatch} alt="" />
                        <p className="logo__top">MASM</p>
                        <p className="logo__mid">Runner</p>
                        <p className="logo__bottom">VSCode</p>
                        <span className="logo__x86">x86</span>
                    </div>
                </div>
                <div className="loading__container">
                    <div className="loading__container__box"></div>
                    <div className="loading__container__box"></div>
                    <div className="loading__container__box"></div>
                </div>
                <p className="loading__stage" role="status">{stage}&hellip;</p>
            </div>)}
        </div>
    );
};

export default LoadingScreen;
