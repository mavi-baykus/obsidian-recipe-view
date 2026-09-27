// Silent looping videos from NoSleep.js (MIT), used to keep the screen on where the Screen
// Wake Lock API isn't available
declare module "nosleep.js/src/media.js" {
    const media: { webm: string; mp4: string };
    export default media;
}
