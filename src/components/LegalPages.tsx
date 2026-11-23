import Logo from './Logo'

export default function LegalPages() {
  const path = window.location.pathname.replace(/\/+$/, '')
  const privacy = path.endsWith('/privacy')
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-5 py-8">
      <a href={import.meta.env.BASE_URL} className="mb-6 inline-flex"><Logo /></a>
      <p className="eyebrow">Cznnect · Last updated 23 November 2026</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold">{privacy ? 'Privacy Policy' : 'Terms & Conditions'}</h1>
      {privacy ? <div className="mt-6 space-y-5 text-sm leading-7">
        <section><h2 className="font-bold text-base">1. Information collected</h2><p>Cznnect processes information you provide, including your email address, birthday, profile details, family connections, posts, plans, places, ratings and activity. Authentication credentials are handled by our authentication provider.</p></section>
        <section><h2 className="font-bold text-base">2. How information is used</h2><p>Information helps create and secure your account, connect invited relatives, provide app features, send service notifications, maintain the service and prevent misuse.</p></section>
        <section><h2 className="font-bold text-base">3. Family visibility</h2><p>Your birthday and profile details may be visible to members of the family space you join. Content you add to shared family features is visible to people with access to that family. Only share information you are comfortable sharing with them.</p></section>
        <section><h2 className="font-bold text-base">4. Device permissions</h2><p>Camera access supports QR scanning; location supports location-based features; notifications support reminders and updates. You can manage permissions in your device settings. Some features may not work without them.</p></section>
        <section><h2 className="font-bold text-base">5. Email preferences</h2><p>Essential account and service messages may still be sent. Optional news and promotional emails are separate and can be declined during registration or changed later in Settings, where available.</p></section>
        <section><h2 className="font-bold text-base">6. Service providers and security</h2><p>Cznnect uses third-party infrastructure, including Supabase, for authentication, database and hosting services. We take reasonable steps to protect information, but no online service can guarantee absolute security.</p></section>
        <section><h2 className="font-bold text-base">7. Retention and deletion</h2><p>Information may be retained while needed to provide the service and for legitimate operational or legal needs. Account and family deletion may depend on the controls available in the app and the permissions of the family host.</p></section>
        <section><h2 className="font-bold text-base">8. Younger users</h2><p>Cznnect is designed for family groups. Younger users should involve a parent or guardian where appropriate. Do not submit another person's personal information unless you have permission to do so.</p></section>
        <section><h2 className="font-bold text-base">9. Updates and questions</h2><p>This policy may change as Cznnect evolves. The current version will be published here. For privacy questions, contact the Cznnect administrator using the contact method provided in the app.</p></section>
      </div> : <div className="mt-6 space-y-5 text-sm leading-7">
        <section><h2 className="font-bold text-base">1. About Cznnect</h2><p>Cznnect is a family-focused service for connecting invited relatives, sharing family information, coordinating activities and recording places and experiences.</p></section>
        <section><h2 className="font-bold text-base">2. Your account</h2><p>Provide accurate information, keep your sign-in credentials private and take responsibility for activity under your account. You must be eligible to use the service under applicable requirements and laws.</p></section>
        <section><h2 className="font-bold text-base">3. Family spaces and content</h2><p>Family spaces are intended for people who know and trust one another. Content shared in a family space may be visible to its members. The family host may have additional administrative controls over membership and shared data.</p></section>
        <section><h2 className="font-bold text-base">4. Acceptable use</h2><p>Do not misuse Cznnect, access another person's account or data without permission, disrupt the service, impersonate others, upload unlawful material, or use the service to harass or threaten anyone.</p></section>
        <section><h2 className="font-bold text-base">5. Your content</h2><p>You remain responsible for content you submit. Only share information and images you have permission to use. You allow Cznnect to store and display that content as needed to provide the features you choose to use.</p></section>
        <section><h2 className="font-bold text-base">6. Permissions and availability</h2><p>Some features require camera, location or notification permissions. Features may change, be suspended or be discontinued. We aim to keep Cznnect available but cannot promise uninterrupted or error-free operation.</p></section>
        <section><h2 className="font-bold text-base">7. Account restrictions</h2><p>Access may be restricted when an account or activity threatens the security or proper operation of Cznnect or violates these terms. Available account and family deletion controls may be subject to host permissions.</p></section>
        <section><h2 className="font-bold text-base">8. Disclaimer</h2><p>Cznnect is provided on an “as available” basis to the extent permitted by applicable law. Nothing in these terms removes rights that cannot legally be excluded.</p></section>
        <section><h2 className="font-bold text-base">9. Changes</h2><p>These terms may be revised as the service evolves. The current version will be published here. Your continued use is subject to the revised terms to the extent permitted by applicable law.</p></section>
      </div>}
      <a href={import.meta.env.BASE_URL} className="btn btn-primary mt-8 w-full">Back to Cznnect</a>
    </main>
  )
}
