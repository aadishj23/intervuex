export default {
  providers: [
    {
      // This should match the 'iss' (issuer) claim in your Clerk JWT template.
      // Set per Convex deployment via `npx convex env set CLERK_JWT_ISSUER_DOMAIN ...`
      //   dev  -> https://legible-mammoth-92.clerk.accounts.dev
      //   prod -> https://clerk.intervuex.aadishjain.dev
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      // This should match the 'aud' (audience) claim in your Clerk JWT template
      applicationID: "convex",
    },
  ],
};
