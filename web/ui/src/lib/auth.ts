import GraphQLAdapter from '@lib/GraphqlAdapter';
import { decodeJWT, encodeJWT } from '@lib/jwt';
import { AdapterUser, NextAuthOptions } from 'next-auth';
import FortyTwoProvider from 'next-auth/providers/42-school';
import DiscordProvider from 'next-auth/providers/discord';
import GithubProvider from 'next-auth/providers/github';
import GitlabProvider from 'next-auth/providers/gitlab';
import RedditProvider from 'next-auth/providers/reddit';
import SpotifyProvider from 'next-auth/providers/spotify';
import TwitchProvider from 'next-auth/providers/twitch';
import { DuoProfile, JWT } from 'types/next-auth';

export const nextAuthOptions: NextAuthOptions = {
  // @ts-ignore
  adapter: GraphQLAdapter(),
  // https://next-auth.js.org/configuration/providers
  providers: [
    FortyTwoProvider({
      clientId: process.env.FORTY_TWO_ID as string,
      clientSecret: process.env.FORTY_TWO_SECRET as string,
      // allowDangerousEmailAccountLinking
      // https://next-auth.js.org/configuration/providers/oauth#allowdangerousemailaccountlinking-option
      //
      // We allow email linking to the account due to the fact of 42 email are
      // unique and not editable by the user. The user is already present on database
      // when he be connected on cluster before.
      allowDangerousEmailAccountLinking: true,
      // 42 API is slow sometimes and we need to increase the timeout
      // to avoid 500 Gateway Timeout error.
      httpOptions: {
        timeout: 10000,
      },
    }),
    DiscordProvider({
      clientId: process.env.DISCORD_ID as string,
      clientSecret: process.env.DISCORD_SECRET as string,
      authorization:
        'https://discord.com/api/oauth2/authorize?scope=identify+email+guilds.join',
    }),
    GithubProvider({
      clientId: process.env.GITHUB_ID as string,
      clientSecret: process.env.GITHUB_SECRET as string,
      authorization:
        'https://github.com/login/oauth/authorize?scope=user:email',
    }),
    GitlabProvider({
      clientId: process.env.GITLAB_ID as string,
      clientSecret: process.env.GITLAB_SECRET as string,
    }),
    // Need special review from Instagram to use this provider
    // Disabled during the app verification
    // InstagramProvider({
    //   clientId: process.env.INSTAGRAM_ID as string,
    //   clientSecret: process.env.INSTAGRAM_SECRET as string,
    // }),
    // Disabled due LinkedIn restrictions on vanityName
    // LinkedinProvider({
    //   clientId: process.env.LINKEDIN_ID as string,
    //   clientSecret: process.env.LINKEDIN_SECRET as string,
    // }),
    RedditProvider({
      clientId: process.env.REDDIT_ID as string,
      clientSecret: process.env.REDDIT_SECRET as string,
    }),
    // Need special review from Spotify to use this provider
    SpotifyProvider({
      clientId: process.env.SPOTIFY_ID as string,
      clientSecret: process.env.SPOTIFY_SECRET as string,
    }),
    // Disabled due twitter restrictions
    // TwitterProvider({
    //   clientId: process.env.TWITTER_ID as string,
    //   clientSecret: process.env.TWITTER_SECRET as string,
    // }),
    TwitchProvider({
      clientId: process.env.TWITCH_ID as string,
      clientSecret: process.env.TWITCH_SECRET as string,
    }),
  ],

  session: {
    // Use JSON Web Tokens for session instead of database sessions.
    // This option can be used with or without a database for users/accounts.
    // Note: `strategy` should be set to 'jwt' if no database is used.
    strategy: 'jwt',

    // Seconds - How long until an idle session expires and is no longer valid.
    maxAge: 30 * 24 * 60 * 60, // 30 days

    // Seconds - Throttle how frequently to write to database to extend a session.
    // Use it to limit write operations. Set to 0 to always update the database.
    // Note: This option is ignored if using JSON Web Tokens
    // updateAge: 24 * 60 * 60, // 24 hours
  },

  // JSON Web tokens are only used for sessions if the `jwt: true` session
  // option is set - or by default if no database is specified.
  // https://next-auth.js.org/configuration/options#jwt
  jwt: {
    // encode the payload
    encode: encodeJWT,
    decode: decodeJWT,
  },

  // You can define custom pages to override the built-in ones. These will be regular Next.js pages
  // so ensure that they are placed outside of the '/api' folder, e.g. signIn: '/auth/mycustom-signin'
  // The routes shown here are the default URLs that will be used when a custom
  // pages is not specified for that route.
  // https://next-auth.js.org/configuration/pages
  pages: {
    signIn: '/auth/signin',
    // signOut: '/auth/signout', // Displays form with sign out button
    error: '/auth/signin', // Error code passed in query string as ?error=
    // verifyRequest: '/auth/verify-request', // Used for check email page
    // newUser: null // If set, new users will be directed here on first sign in
  },

  // Callbacks are asynchronous functions you can use to control what happens
  // when an action is performed.
  // https://next-auth.js.org/configuration/callbacks
  callbacks: {
    async signIn({ user, account, profile }) {
      // Extend account with additional profile data to be saved to database
      // with linkAccount function on adapter

      if (!account || !profile) {
        return false;
      }

      account._profile = {
        login: (profile.login as string) || '',
      };

      if (account.provider == '42-school') {
        (user as AdapterUser).duo = {
          id: profile.id,
          login: profile.login,
          firstName: profile.first_name,
          lastName: profile.last_name,
          usualFirstName: profile.usual_first_name,
          imageUrl: (profile.image as any)?.link,
          imageSmallUrl: (profile.image as any)?.versions?.small,
          poolYear: profile.pool_year,
          poolMonth: profile.pool_month,
          phone: profile.phone,
          isStaff: profile['staff?'] || false,
          currentCampusID: (profile as DuoProfile).campus_users.find(
            (cu) => cu.is_primary
          )?.campus_id as number, // user will always have a primary campus
        };
        return true;
      }

      switch (account.provider) {
        case 'github':
          (user as AdapterUser).github = {
            id: profile.id,
            login: profile.login,
            type: profile.type,
          };
          return true;

        case 'discord':
          if (profile.discriminator === '0000')
            account._profile.login = profile.username;
          else
            account._profile.login = `${profile.username}#${profile.discriminator}`;
          return true;

        case 'gitlab' || 'twitter' || 'instagram':
          account._profile.login = profile.username;
          return true;

        case 'twitch':
          account._profile.login = profile.preferred_username;
          return true;

        case 'reddit':
          account._profile.login = profile.name!;
          return true;

        case 'linkedin':
          account._profile.login = profile.vanityName!;
          return true;

        case 'spotify':
          account._profile.login = profile.display_name;
          return true;

        default:
          throw new Error(`Unknown provider ${account.provider}`);
      }
    },

    async session({ session, token }) {
      delete session.user;
      if (token) session.token = token as JWT;
      return session;
    },

    async jwt({ token }) {
      return token;
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) return url;
      // Allows relative callback URLs
      else if (url.startsWith('/')) return new URL(url, baseUrl).toString();
      return baseUrl;
    },
  },

  // Events are useful for logging
  // https://next-auth.js.org/configuration/events
  events: {},

  cookies: {
    // Wait the merge of the PR before enabling this
    // https://github.com/nextauthjs/next-auth/pull/4385#issuecomment-1098584113
    sessionToken: {
      name: `__s42.auth-token`,
      options: {
        httpOnly: false,
        sameSite: 'lax',
        path: '/',
        secure: true,
      },
    },
    callbackUrl: {
      name: `__s42.callback-url`,
      options: {
        sameSite: 'lax',
        path: '/',
        secure: true,
      },
    },
    csrfToken: {
      name: `__s42.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true,
      },
    },
  },

  // Enable debug messages in the console if you are having problems
  debug: process.env.NODE_ENV !== 'production',
};
