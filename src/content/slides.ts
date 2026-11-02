// ─────────────────────────────────────────────────────────────
// PRESENTATION CONTENT — edit this file to change the workshop.
//
// • Replace images/videos by dropping files into /public/media and
//   updating the `src` paths below (keep them under /media/ so they
//   are cached for offline playback).
// • Add slides by appending objects. Supported kinds:
//   'title' | 'bullets' | 'poll' | 'beforeAfter' | 'video'
// • Poll ids must be unique; votes are stored against them.
// ─────────────────────────────────────────────────────────────
import type { Section, Slide } from '../types';

export const presentationTitle = 'Real Estate Marketing in 2027 — Made Simple';
export const presenterBrand = 'High Point Perspective';
export const workshopMinutes = 45;

export const sections: Section[] = [
  { id: 'marketing-2027', number: 1, title: 'Real Estate Marketing in 2027' },
  { id: 'smartphone', number: 2, title: 'Smartphone Photography and Video' },
  { id: 'chatgpt', number: 3, title: 'ChatGPT for Twilight Images and Virtual Staging' },
  { id: 'cloudpano-autohdr', number: 4, title: 'CloudPano and AutoHDR' },
  { id: 'social', number: 5, title: 'Facebook, Instagram, and Personal Branding' },
  { id: 'playbook', number: 6, title: "The Agent's Weekly Marketing Playbook" },
];

export const slides: Slide[] = [
  {
    id: 'welcome',
    kind: 'title',
    section: 'marketing-2027',
    title: 'Real Estate Marketing in 2027',
    subtitle: 'Made simple. Six tools, one weekly playbook, zero jargon.',
    image: { src: '/media/hero-exterior.jpg', alt: 'Bright two-story home on a sunny day' },
    notes:
      'Welcome everyone. Point to the QR code: scan, type your first name, and your phone follows along. ' +
      'Mention they can swipe back any time and tap "Catch Up Live" to rejoin.',
  },
  {
    id: 'what-buyers-see',
    kind: 'bullets',
    section: 'marketing-2027',
    title: 'What buyers see first',
    bullets: [
      'Your first photo is the first showing',
      'Short vertical video beats long tours',
      'Consistency builds trust faster than polish',
      'Simple tools, used weekly, win',
    ],
    image: { src: '/media/listing-exterior.jpg', alt: 'Light blue home with a red door' },
    notes:
      '90 seconds. Ask: who has lost a showing because of a dark listing photo? Keep it light and quick.',
  },
  {
    id: 'poll-first-look',
    kind: 'poll',
    section: 'marketing-2027',
    title: 'Quick poll',
    poll: {
      id: 'first-look',
      question: 'Where do your buyers usually see your listing first?',
      options: ['Zillow or Realtor.com', 'Instagram or Facebook', 'Google search', 'A friend or referral'],
    },
    notes:
      'Tap "Open poll", give them about 30 seconds, then "Show results". Expect the portals to win, ' +
      'then point out how many saw it on social first.',
  },
  {
    id: 'phone-before-after',
    kind: 'beforeAfter',
    section: 'smartphone',
    title: 'Same phone. 90 seconds of editing.',
    caption: 'Straighten, brighten, warm up. All in the built-in Photos editor.',
    before: { src: '/media/phone-before.jpg', alt: 'Dark, tilted phone photo of a house', label: 'Before' },
    after: { src: '/media/phone-after.jpg', alt: 'Bright, level edited photo of the same house', label: 'After' },
    notes:
      'Drag the slider on your phone to sweep the screen. Call out the three fixes: level horizon, ' +
      'exposure up, warmth up. Invite them to drag it on their own phones.',
  },
  {
    id: 'demo-walkthrough',
    kind: 'video',
    section: 'smartphone',
    title: 'Demo: a 60-second walkthrough',
    caption: 'Shot on a phone with a $20 gimbal. Slow, steady, room to room.',
    video: { src: '/media/demo-walkthrough.mp4', poster: '/media/demo-poster.jpg' },
    notes: 'Press Play on your phone. Pause at the kitchen to point out the slow pan.',
  },
];

export function sectionFor(slide: Slide): Section | undefined {
  return sections.find((s) => s.id === slide.section);
}

export function pollSlides() {
  return slides.filter((s): s is Extract<Slide, { kind: 'poll' }> => s.kind === 'poll');
}

export function findPoll(pollId: string | null | undefined) {
  if (!pollId) return undefined;
  return pollSlides().find((s) => s.poll.id === pollId)?.poll;
}

/** Every media URL, so screens can preload/cache them for offline use. */
export function allMediaUrls(): string[] {
  const urls = new Set<string>();
  for (const s of slides) {
    if ('image' in s && s.image) urls.add(s.image.src);
    if (s.kind === 'beforeAfter') { urls.add(s.before.src); urls.add(s.after.src); }
    if (s.kind === 'video') { urls.add(s.video.src); if (s.video.poster) urls.add(s.video.poster); }
  }
  return [...urls];
}
