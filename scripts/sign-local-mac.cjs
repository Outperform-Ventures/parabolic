const {execFileSync}=require('node:child_process');
const path=require('node:path');
// Bind the local app's bundle identifier and resources for macOS notification APIs.
// This is an ad-hoc development signature, not Developer ID distribution signing.
module.exports=async context=>{if(process.platform!=='darwin'||process.env.PARABOLIC_UPDATE_FEED_URL)return;const app=path.join(context.appOutDir,context.packager.appInfo.productFilename+'.app');execFileSync('/usr/bin/codesign',['--force','--deep','--sign','-',app],{stdio:'inherit'});execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',app],{stdio:'inherit'});};
