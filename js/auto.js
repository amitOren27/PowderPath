// js/auth.js  — debug version with dynamic imports
console.log("AUTH: auth.js starting");
window.AMPLIFY_READY = false;

const USER_POOL_ID = "us-east-1_MxWVIAmRz";
const USER_POOL_WEB_CLIENT_ID = "617etuo374sjr1dlqauaohpil4";
const COGNITO_DOMAIN = "us-east-1mxwviamrz.auth.us-east-1.amazoncognito.com";
const REDIRECTS = [
  "https://production.dhjqpilg73hra.amplifyapp.com/html/",
  "http://localhost:8000/html/"
];

try {
  // נסה esm.sh
  const { Amplify } = await import("https://esm.sh/aws-amplify@6");
  const {
    fetchAuthSession,
    signInWithRedirect,
    signOut
  } = await import("https://esm.sh/aws-amplify/auth@6");

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: USER_POOL_ID,
        userPoolClientId: USER_POOL_WEB_CLIENT_ID,
        loginWith: {
          oauth: {
            domain: COGNITO_DOMAIN,
            scopes: ["email", "openid", "phone"],
            redirectSignIn: REDIRECTS,
            redirectSignOut: REDIRECTS,
            responseType: "code"
          }
        }
      }
    }
  });

  // פונקציות גלובליות
  window.login = () => signInWithRedirect();
  window.logout = () => signOut();
  window.getIdToken = async () => {
    const { tokens } = await fetchAuthSession();
    return tokens?.idToken?.toString();
  };
  window.getUserSub = async () => {
    const { tokens } = await fetchAuthSession();
    return tokens?.idToken?.payload?.sub;
  };

  window.AMPLIFY_READY = true;
  console.log("AUTH: Amplify configured");
} catch (e1) {
  console.error("AUTH: esm.sh import failed:", e1);
  window.AMPLIFY_IMPORT_ERROR = e1;

  // Fallback: נסה jsDelivr בפורמט ESM
  try {
    const { Amplify } = await import("https://cdn.jsdelivr.net/npm/aws-amplify@6/+esm");
    const {
      fetchAuthSession,
      signInWithRedirect,
      signOut
    } = await import("https://cdn.jsdelivr.net/npm/aws-amplify@6/auth/+esm");

    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId: USER_POOL_ID,
          userPoolClientId: USER_POOL_WEB_CLIENT_ID,
          loginWith: {
            oauth: {
              domain: COGNITO_DOMAIN,
              scopes: ["email", "openid", "phone"],
              redirectSignIn: REDIRECTS,
              redirectSignOut: REDIRECTS,
              responseType: "code"
            }
          }
        }
      }
    });

    window.login = () => signInWithRedirect();
    window.logout = () => signOut();
    window.getIdToken = async () => {
      const { tokens } = await fetchAuthSession();
      return tokens?.idToken?.toString();
    };
    window.getUserSub = async () => {
      const { tokens } = await fetchAuthSession();
      return tokens?.idToken?.payload?.sub;
    };

    window.AMPLIFY_READY = true;
    console.log("AUTH: Amplify configured (jsDelivr fallback)");
  } catch (e2) {
    console.error("AUTH: jsDelivr import failed:", e2);
    window.AMPLIFY_IMPORT_ERROR_FALLBACK = e2;
  }
}
