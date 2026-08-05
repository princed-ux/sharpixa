import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "Privacy Policy",

  description:
    "Read how Sharpixa handles browser-based file processing, cookies, advertising resources, technical information, and privacy choices.",

  alternates: {
    canonical: "/privacy/",
  },

  openGraph: {
    type: "website",
    url: "/privacy/",
    title: "Privacy Policy | Sharpixa",
    description:
      "Information about browser processing, cookies, advertising, third-party resources, and privacy choices on Sharpixa.",
    siteName: "Sharpixa",
  },
};

const SECTIONS = [
  {
    id: "scope",
    title: "Scope",
  },
  {
    id: "file-processing",
    title: "File Processing",
  },
  {
    id: "information-collected",
    title: "Information Collected",
  },
  {
    id: "cookies-storage",
    title: "Cookies and Storage",
  },
  {
    id: "advertising",
    title: "Advertising",
  },
  {
    id: "consent",
    title: "Consent Choices",
  },
  {
    id: "third-parties",
    title: "Third-Party Services",
  },
  {
    id: "retention-security",
    title: "Retention and Security",
  },
  {
    id: "privacy-rights",
    title: "Privacy Rights",
  },
  {
    id: "children",
    title: "Children",
  },
  {
    id: "policy-changes",
    title: "Policy Changes",
  },
  {
    id: "contact",
    title: "Contact",
  },
];

export default function PrivacyPage() {
  return (
    <InfoPage
      eyebrow="Privacy and data information"
      title="Privacy Policy"
      description="This policy explains how Sharpixa's website, editing tools, advertising resources, and supporting technologies may process information."
      icon="shield"
      lastUpdated="August 2, 2026"
      sections={SECTIONS}
      notice={
        <p>
          Sharpixa’s core media-editing workflow is designed to process files
          inside your browser. Advertising, model, analytics, and application
          resources may still communicate with third-party services as
          described below.
        </p>
      }
    >
      <section>
        <h2 id="scope">
          1. Scope of This Policy
        </h2>

        <p>
          This Privacy Policy applies to the Sharpixa website, its browser-based
          media tools, informational pages, advertisements, and related website
          resources.
        </p>

        <p>
          It does not control the independent privacy practices of external
          websites or services that users visit through third-party links.
        </p>
      </section>

      <section>
        <h2 id="file-processing">
          2. File Processing
        </h2>

        <p>
          Sharpixa’s core editing tools are designed to process selected images
          and videos locally inside the browser. The source file does not need
          to be intentionally uploaded to a Sharpixa processing server for the
          core workflow.
        </p>

        <p>
          The browser may create temporary object URLs, Canvas data, encoded
          media, cached resources, or other temporary processing information.
          This information may remain in browser memory until the page is
          closed, refreshed, reset, or the browser clears it.
        </p>

        <p>
          Future features that require server upload or storage will identify
          that behavior before the user submits a file and may be covered by an
          updated version of this policy.
        </p>
      </section>

      <section>
        <h2 id="information-collected">
          3. Information That May Be Collected
        </h2>

        <h3>
          Information You Provide
        </h3>

        <p>
          Sharpixa may receive information that you voluntarily send through
          email, such as your name, email address, support details, error
          reports, feedback, privacy requests, or copyright reports.
        </p>

        <h3>
          Technical Information
        </h3>

        <p>
          The website or its third-party providers may automatically process
          technical information such as:
        </p>

        <ul>
          <li>IP address or approximate geographic region.</li>
          <li>Browser type, browser version, and language.</li>
          <li>Operating system and device type.</li>
          <li>Referring and visited pages.</li>
          <li>Date, time, and approximate session duration.</li>
          <li>Cookie identifiers or similar browser identifiers.</li>
          <li>Advertising impressions, interactions, and fraud signals.</li>
          <li>Basic error, performance, and compatibility information.</li>
        </ul>

        <p>
          Sharpixa does not need to inspect the contents of a locally processed
          source file to provide the core browser-editing workflow.
        </p>
      </section>

      <section>
        <h2 id="cookies-storage">
          4. Cookies and Similar Storage
        </h2>

        <p>
          Cookies, browser storage, caches, and similar technologies may be
          used to support security, preferences, performance, advertising,
          consent choices, fraud prevention, and measurement.
        </p>

        <p>
          Browser caches may also retain application code, model files, runtime
          resources, images, or other static assets so that later visits load
          more efficiently.
        </p>

        <p>
          You can restrict or remove cookies and site data through your browser
          settings. Blocking required storage or scripts may prevent certain
          features, advertisements, or consent controls from working properly.
        </p>
      </section>

      <section>
        <h2 id="advertising">
          5. Google AdSense and Advertising
        </h2>

        <p>
          Sharpixa may use Google AdSense and other approved advertising
          services to display advertisements.
        </p>

        <p>
          Third-party vendors, including Google, may use cookies to serve ads
          based on a user’s previous visits to Sharpixa or other websites.
          Google’s use of advertising cookies enables Google and its partners
          to serve personalized or non-personalized advertisements, measure
          performance, limit repeated ads, and help detect invalid activity.
        </p>

        <p>
          Advertising requests may involve information such as IP address,
          browser information, cookie identifiers, page context, approximate
          location, and advertisement interactions.
        </p>

        <p>
          You can learn how Google uses information from partner websites at{" "}
          <a
            href="https://policies.google.com/technologies/partner-sites"
            target="_blank"
            rel="noreferrer"
          >
            Google’s partner-sites privacy information
          </a>
          .
        </p>

        <p>
          You can manage or opt out of personalized Google advertising through{" "}
          <a
            href="https://adssettings.google.com/"
            target="_blank"
            rel="noreferrer"
          >
            Google Ads Settings
          </a>
          . Depending on your location, additional industry opt-out tools may
          also be available.
        </p>
      </section>

      <section>
        <h2 id="consent">
          6. Consent and Advertising Choices
        </h2>

        <p>
          Depending on your location, Sharpixa or an authorized
          consent-management platform may ask for consent before using certain
          cookies, local storage, personalized-advertising data, or measurement
          technologies.
        </p>

        <p>
          Where required for users in the European Economic Area, the United
          Kingdom, or Switzerland, Sharpixa intends to use a Google-certified
          consent-management platform integrated with the applicable
          advertising-consent framework.
        </p>

        <p>
          Available controls may include consenting, refusing consent, or
          managing specific purposes and vendors. Withdrawing consent does not
          necessarily remove information already processed lawfully before the
          withdrawal.
        </p>
      </section>

      <section>
        <h2 id="third-parties">
          7. Third-Party Resources
        </h2>

        <p>
          Sharpixa may load services or resources supplied by third parties,
          including:
        </p>

        <ul>
          <li>Google AdSense and related advertising infrastructure.</li>
          <li>Consent-management services.</li>
          <li>
            Background-removal model files and browser machine-learning
            runtimes.
          </li>
          <li>Content-delivery networks and hosting infrastructure.</li>
          <li>Security, performance, or error-diagnostic resources.</li>
        </ul>

        <p>
          These providers may process technical information under their own
          terms and privacy policies. Sharpixa does not control every
          independent decision made by those providers.
        </p>
      </section>

      <section>
        <h2 id="retention-security">
          8. Retention and Security
        </h2>

        <p>
          Sharpixa does not intentionally retain locally processed source files
          on its own file-processing servers as part of the current core
          workflow.
        </p>

        <p>
          Support emails and related correspondence may be retained for as long
          as reasonably necessary to respond, maintain records, resolve
          disputes, prevent abuse, or meet legal obligations.
        </p>

        <p>
          Third-party providers determine their own retention periods.
          Information retained in browser caches or local storage remains
          subject to the user’s browser and device settings.
        </p>

        <p>
          Reasonable technical and organizational measures may be used to
          protect information, but no internet service, device, or storage
          system can guarantee absolute security.
        </p>
      </section>

      <section>
        <h2 id="privacy-rights">
          9. Privacy Rights
        </h2>

        <p>
          Depending on your location, applicable law may provide rights relating
          to access, correction, deletion, restriction, objection,
          portability, withdrawal of consent, or complaints to a regulatory
          authority.
        </p>

        <p>
          A request can be submitted through the{" "}
          <a href="/contact/">
            Contact page
          </a>
          . Sharpixa may request reasonable information to understand and
          verify the request.
        </p>

        <p>
          Requests concerning information controlled independently by Google or
          another provider may need to be submitted directly to that provider.
        </p>
      </section>

      <section>
        <h2 id="children">
          10. Children’s Privacy
        </h2>

        <p>
          Sharpixa is not intentionally directed to children who are unable to
          provide valid consent under applicable law. Children should use the
          service only with the involvement and permission of a parent or legal
          guardian where required.
        </p>

        <p>
          Contact Sharpixa if you believe a child has supplied personal
          information through the website without appropriate authorization.
        </p>
      </section>

      <section>
        <h2 id="policy-changes">
          11. Changes to This Policy
        </h2>

        <p>
          This policy may be updated when Sharpixa changes its tools,
          advertising configuration, service providers, legal obligations, or
          information-handling practices.
        </p>

        <p>
          The current version will display its latest revision date near the
          top of the page.
        </p>
      </section>

      <section>
        <h2 id="contact">
          12. Contact
        </h2>

        <p>
          Privacy questions and requests can be submitted through the{" "}
          <a href="/contact/">
            Sharpixa Contact page
          </a>
          .
        </p>
      </section>
    </InfoPage>
  );
}