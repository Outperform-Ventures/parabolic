export function updateDisabledReason(input:{platform:string;packaged:boolean;managedDisabled:boolean;configured:boolean}){
  if(input.managedDisabled)return 'Automatic updates are disabled by your administrator.';
  if(input.platform!=='darwin')return 'Automatic updates are not configured for this platform.';
  if(!input.packaged)return 'Automatic updates are unavailable in a development build.';
  if(!input.configured)return 'This build has no update service configured.';
  return undefined;
}
