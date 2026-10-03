/** Plain-language text for /?auth=error&reason=… from the Kuartal ID login flow. */
export function loginErrorMessage(reason: string | null): string {
  switch (reason) {
    case 'access_denied':
      return 'Sign-in was cancelled on Kuartal ID. Allow Kuartal Terminal to continue.';
    case 'expired':
    case 'state':
      return 'That sign-in link expired. Please log in again.';
    case 'nonce':
    case 'id_token':
    case 'profile':
      return "Kuartal ID couldn't confirm your identity. Please log in again.";
    case 'token':
    case 'userinfo':
      return 'Kuartal ID is not responding right now. Please try again in a minute.';
    default:
      return `Kuartal ID login didn't complete${reason ? ` (${reason})` : ''}. Please try again.`;
  }
}
