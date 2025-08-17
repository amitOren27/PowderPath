import { Amplify } from 'https://esm.sh/aws-amplify@6.15.5';
import {
  getCurrentUser,
  fetchAuthSession,
  signInWithRedirect
} from 'https://esm.sh/aws-amplify@6.15.5/auth';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'us-east-1_MxWVIAmRz',
      userPoolClientId: '4d81fvpp48golq3mtnn5ep0bu0',
      loginWith: {
        oauth: {
          domain: 'us-east-1mxwviamrz.auth.us-east-1.amazoncognito.com',
          scopes: ['openid', 'email'],
          redirectSignIn: ['https://production.dhjqpilg73hra.amplifyapp.com/html/'],
          redirectSignOut: ['https://production.dhjqpilg73hra.amplifyapp.com/html/'],
          responseType: 'code'
        }
      }
    }
  }
});

export async function requireLogin() {
  try {
    const { userId } = await getCurrentUser();
    return userId;
  } catch {
    await signInWithRedirect();
  }
}

