import React, { createContext, useContext, useState, useEffect } from 'react';

export type LangCode = 'hi' | 'en' | 'ta' | 'te' | 'bn' | 'mr' | 'gu' | 'pa' | 'ur' | 'kn';

export interface Language {
  code: LangCode;
  name: string;
  nativeName: string;
  flag: string;
}

export const LANGUAGES: Language[] = [
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇮🇳' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', flag: '🇮🇳' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', flag: '🇵🇰' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', flag: '🇮🇳' },
];

// All UI string translations
export type TranslationKey =
  | 'home' | 'search' | 'create' | 'stories' | 'chat' | 'profile' | 'notifications'
  | 'settings' | 'logout' | 'login' | 'register' | 'email' | 'password' | 'username'
  | 'signIn' | 'signUp' | 'createAccount' | 'alreadyHaveAccount' | 'dontHaveAccount'
  | 'post' | 'reel' | 'reels' | 'like' | 'comment' | 'share' | 'save' | 'follow'
  | 'unfollow' | 'following' | 'followers' | 'posts' | 'editProfile' | 'language'
  | 'selectLanguage' | 'darkMode' | 'lightMode' | 'newPost' | 'newReel' | 'newStory'
  | 'caption' | 'upload' | 'uploadVideo' | 'uploadImage' | 'publish' | 'cancel'
  | 'typeMessage' | 'noMessages' | 'online' | 'offline' | 'typing' | 'seen'
  | 'adminPanel' | 'dashboard' | 'users' | 'reports' | 'verified' | 'pending'
  | 'approve' | 'reject' | 'delete' | 'suspend' | 'block' | 'noNotifications'
  | 'helpCenter' | 'reportProblem' | 'privacy' | 'deleteAccount' | 'verification'
  | 'requestVerification' | 'submitted' | 'views' | 'welcomeBack' | 'noPostsYet'
  | 'noReelsYet' | 'noStoriesYet' | 'fullName' | 'bio' | 'website' | 'save2'
  | 'mutualFollowsOnly' | 'privateAccount' | 'broadcast' | 'analytics' | 'contentModeration';

type Translations = Record<TranslationKey, string>;

const translations: Record<LangCode, Translations> = {
  hi: {
    home: 'होम', search: 'खोजें', create: 'बनाएं', stories: 'स्टोरीज़', chat: 'चैट',
    profile: 'प्रोफाइल', notifications: 'सूचनाएं', settings: 'सेटिंग्स', logout: 'लॉगआउट',
    login: 'लॉगिन', register: 'रजिस्टर', email: 'ईमेल', password: 'पासवर्ड',
    username: 'यूज़रनेम', signIn: 'साइन इन', signUp: 'साइन अप',
    createAccount: 'अकाउंट बनाएं', alreadyHaveAccount: 'पहले से अकाउंट है?',
    dontHaveAccount: 'अकाउंट नहीं है?', post: 'पोस्ट', reel: 'रील', reels: 'रील्स',
    like: 'लाइक', comment: 'कमेंट', share: 'शेयर', save: 'सेव', follow: 'फॉलो',
    unfollow: 'अनफॉलो', following: 'फॉलोइंग', followers: 'फॉलोअर्स', posts: 'पोस्ट्स',
    editProfile: 'प्रोफाइल एडिट करें', language: 'भाषा', selectLanguage: 'भाषा चुनें',
    darkMode: 'डार्क मोड', lightMode: 'लाइट मोड', newPost: 'नई पोस्ट', newReel: 'नई रील',
    newStory: 'नई स्टोरी', caption: 'कैप्शन', upload: 'अपलोड', uploadVideo: 'वीडियो अपलोड करें',
    uploadImage: 'फोटो अपलोड करें', publish: 'प्रकाशित करें', cancel: 'रद्द करें',
    typeMessage: 'मैसेज टाइप करें...', noMessages: 'अभी कोई मैसेज नहीं', online: 'ऑनलाइन',
    offline: 'ऑफलाइन', typing: 'टाइप कर रहा है...', seen: 'देखा',
    adminPanel: 'एडमिन पैनल', dashboard: 'डैशबोर्ड', users: 'यूज़र्स', reports: 'रिपोर्ट्स',
    verified: 'वेरिफाइड', pending: 'लंबित', approve: 'स्वीकार करें', reject: 'अस्वीकार करें',
    delete: 'हटाएं', suspend: 'निलंबित करें', block: 'ब्लॉक करें',
    noNotifications: 'कोई सूचना नहीं', helpCenter: 'सहायता केंद्र', reportProblem: 'समस्या रिपोर्ट करें',
    privacy: 'गोपनीयता', deleteAccount: 'अकाउंट हटाएं', verification: 'वेरिफिकेशन',
    requestVerification: 'वेरिफिकेशन माँगें', submitted: 'सबमिट किया',
    views: 'व्यूज़', welcomeBack: 'वापस स्वागत है!', noPostsYet: 'अभी कोई पोस्ट नहीं',
    noReelsYet: 'अभी कोई रील नहीं', noStoriesYet: 'अभी कोई स्टोरी नहीं',
    fullName: 'पूरा नाम', bio: 'बायो', website: 'वेबसाइट', save2: 'सेव करें',
    mutualFollowsOnly: 'केवल म्यूचुअल फॉलोज़', privateAccount: 'प्राइवेट अकाउंट',
    broadcast: 'ब्रॉडकास्ट', analytics: 'एनालिटिक्स', contentModeration: 'कंटेंट मॉडरेशन',
  },
  en: {
    home: 'Home', search: 'Search', create: 'Create', stories: 'Stories', chat: 'Chat',
    profile: 'Profile', notifications: 'Notifications', settings: 'Settings', logout: 'Log Out',
    login: 'Login', register: 'Register', email: 'Email', password: 'Password',
    username: 'Username', signIn: 'Sign In', signUp: 'Sign Up',
    createAccount: 'Create Account', alreadyHaveAccount: 'Already have an account?',
    dontHaveAccount: "Don't have an account?", post: 'Post', reel: 'Reel', reels: 'Reels',
    like: 'Like', comment: 'Comment', share: 'Share', save: 'Save', follow: 'Follow',
    unfollow: 'Unfollow', following: 'Following', followers: 'Followers', posts: 'Posts',
    editProfile: 'Edit Profile', language: 'Language', selectLanguage: 'Select Language',
    darkMode: 'Dark Mode', lightMode: 'Light Mode', newPost: 'New Post', newReel: 'New Reel',
    newStory: 'New Story', caption: 'Caption', upload: 'Upload', uploadVideo: 'Upload Video',
    uploadImage: 'Upload Photo', publish: 'Publish', cancel: 'Cancel',
    typeMessage: 'Type a message...', noMessages: 'No messages yet', online: 'Online',
    offline: 'Offline', typing: 'Typing...', seen: 'Seen',
    adminPanel: 'Admin Panel', dashboard: 'Dashboard', users: 'Users', reports: 'Reports',
    verified: 'Verified', pending: 'Pending', approve: 'Approve', reject: 'Reject',
    delete: 'Delete', suspend: 'Suspend', block: 'Block',
    noNotifications: 'No notifications', helpCenter: 'Help Center', reportProblem: 'Report Problem',
    privacy: 'Privacy', deleteAccount: 'Delete Account', verification: 'Verification',
    requestVerification: 'Request Verification', submitted: 'Submitted',
    views: 'Views', welcomeBack: 'Welcome back!', noPostsYet: 'No posts yet',
    noReelsYet: 'No reels yet', noStoriesYet: 'No stories yet',
    fullName: 'Full Name', bio: 'Bio', website: 'Website', save2: 'Save',
    mutualFollowsOnly: 'Mutual Follows Only', privateAccount: 'Private Account',
    broadcast: 'Broadcast', analytics: 'Analytics', contentModeration: 'Content Moderation',
  },
  ta: {
    home: 'முகப்பு', search: 'தேடு', create: 'உருவாக்கு', stories: 'கதைகள்', chat: 'அரட்டை',
    profile: 'சுயவிவரம்', notifications: 'அறிவிப்புகள்', settings: 'அமைப்புகள்', logout: 'வெளியேறு',
    login: 'உள்நுழைவு', register: 'பதிவு', email: 'மின்னஞ்சல்', password: 'கடவுச்சொல்',
    username: 'பயனர்பெயர்', signIn: 'உள்நுழைக', signUp: 'பதிவு செய்க',
    createAccount: 'கணக்கு உருவாக்கு', alreadyHaveAccount: 'ஏற்கனவே கணக்கு உள்ளதா?',
    dontHaveAccount: 'கணக்கு இல்லையா?', post: 'இடுகை', reel: 'ரீல்', reels: 'ரீல்கள்',
    like: 'விரும்பு', comment: 'கருத்து', share: 'பகிர்', save: 'சேமி', follow: 'பின்தொடர்',
    unfollow: 'நிறுத்து', following: 'பின்தொடர்கிறது', followers: 'பின்தொடர்பவர்கள்', posts: 'இடுகைகள்',
    editProfile: 'சுயவிவரத்தை திருத்து', language: 'மொழி', selectLanguage: 'மொழி தேர்வு',
    darkMode: 'இருண்ட பயன்முறை', lightMode: 'ஒளி பயன்முறை', newPost: 'புதிய இடுகை', newReel: 'புதிய ரீல்',
    newStory: 'புதிய கதை', caption: 'தலைப்பு', upload: 'பதிவேற்று', uploadVideo: 'வீடியோ பதிவேற்று',
    uploadImage: 'படம் பதிவேற்று', publish: 'வெளியிடு', cancel: 'ரத்து',
    typeMessage: 'செய்தி தட்டச்சு...', noMessages: 'செய்திகள் இல்லை', online: 'நேரலை',
    offline: 'ஆஃப்லைன்', typing: 'தட்டச்சு செய்கிறார்...', seen: 'பார்த்தார்',
    adminPanel: 'நிர்வாக பலகை', dashboard: 'டாஷ்போர்ட்', users: 'பயனர்கள்', reports: 'அறிக்கைகள்',
    verified: 'சரிபார்க்கப்பட்டது', pending: 'நிலுவையில்', approve: 'அனுமதி', reject: 'நிராகரி',
    delete: 'நீக்கு', suspend: 'இடைநிறுத்து', block: 'தடை',
    noNotifications: 'அறிவிப்புகள் இல்லை', helpCenter: 'உதவி மையம்', reportProblem: 'சிக்கல் தெரிவி',
    privacy: 'தனியுரிமை', deleteAccount: 'கணக்கை நீக்கு', verification: 'சரிபார்ப்பு',
    requestVerification: 'சரிபார்ப்பு கோரு', submitted: 'சமர்ப்பிக்கப்பட்டது',
    views: 'பார்வைகள்', welcomeBack: 'மீண்டும் வரவேற்கிறோம்!', noPostsYet: 'இடுகைகள் இல்லை',
    noReelsYet: 'ரீல்கள் இல்லை', noStoriesYet: 'கதைகள் இல்லை',
    fullName: 'முழு பெயர்', bio: 'சுயவிவரம்', website: 'வலைதளம்', save2: 'சேமி',
    mutualFollowsOnly: 'பரஸ்பர தொடர்பு மட்டும்', privateAccount: 'தனிப்பட்ட கணக்கு',
    broadcast: 'ஒளிபரப்பு', analytics: 'பகுப்பாய்வு', contentModeration: 'உள்ளடக்க மேலாண்மை',
  },
  te: {
    home: 'హోమ్', search: 'వెతకండి', create: 'సృష్టించు', stories: 'కథలు', chat: 'చాట్',
    profile: 'ప్రొఫైల్', notifications: 'నోటిఫికేషన్లు', settings: 'సెట్టింగులు', logout: 'లాగ్అవుట్',
    login: 'లాగిన్', register: 'నమోదు', email: 'ఇమెయిల్', password: 'పాస్వర్డ్',
    username: 'వినియోగదారు పేరు', signIn: 'సైన్ ఇన్', signUp: 'సైన్ అప్',
    createAccount: 'ఖాతా సృష్టించండి', alreadyHaveAccount: 'ఖాతా ఉందా?',
    dontHaveAccount: 'ఖాతా లేదా?', post: 'పోస్ట్', reel: 'రీల్', reels: 'రీల్స్',
    like: 'లైక్', comment: 'వ్యాఖ్య', share: 'షేర్', save: 'సేవ్', follow: 'ఫాలో',
    unfollow: 'అన్ఫాలో', following: 'ఫాలోయింగ్', followers: 'ఫాలోయర్లు', posts: 'పోస్టులు',
    editProfile: 'ప్రొఫైల్ సవరించు', language: 'భాష', selectLanguage: 'భాష ఎంచుకో',
    darkMode: 'డార్క్ మోడ్', lightMode: 'లైట్ మోడ్', newPost: 'కొత్త పోస్ట్', newReel: 'కొత్త రీల్',
    newStory: 'కొత్త స్టోరీ', caption: 'వివరణ', upload: 'అప్లోడ్', uploadVideo: 'వీడియో అప్లోడ్',
    uploadImage: 'ఫోటో అప్లోడ్', publish: 'ప్రచురించు', cancel: 'రద్దు',
    typeMessage: 'మెసేజ్ టైప్ చేయండి...', noMessages: 'మెసేజ్లు లేవు', online: 'ఆన్లైన్',
    offline: 'ఆఫ్లైన్', typing: 'టైప్ చేస్తున్నారు...', seen: 'చూశారు',
    adminPanel: 'అడ్మిన్ ప్యానెల్', dashboard: 'డాష్బోర్డ్', users: 'వినియోగదారులు', reports: 'నివేదికలు',
    verified: 'ధృవీకరించబడింది', pending: 'పెండింగ్', approve: 'అనుమతి', reject: 'తిరస్కరించు',
    delete: 'తొలగించు', suspend: 'సస్పెండ్', block: 'బ్లాక్',
    noNotifications: 'నోటిఫికేషన్లు లేవు', helpCenter: 'సహాయ కేంద్రం', reportProblem: 'సమస్య నివేదించు',
    privacy: 'గోప్యత', deleteAccount: 'ఖాతా తొలగించు', verification: 'ధృవీకరణ',
    requestVerification: 'ధృవీకరణ కోరండి', submitted: 'సమర్పించబడింది',
    views: 'వీక్షణలు', welcomeBack: 'తిరిగి స్వాగతం!', noPostsYet: 'పోస్టులు లేవు',
    noReelsYet: 'రీల్స్ లేవు', noStoriesYet: 'స్టోరీలు లేవు',
    fullName: 'పూర్తి పేరు', bio: 'బయో', website: 'వెబ్సైట్', save2: 'సేవ్ చేయి',
    mutualFollowsOnly: 'పరస్పర ఫాలో మాత్రమే', privateAccount: 'ప్రైవేట్ ఖాతా',
    broadcast: 'ప్రసారం', analytics: 'విశ్లేషణలు', contentModeration: 'కంటెంట్ నిర్వహణ',
  },
  bn: {
    home: 'হোম', search: 'খুঁজুন', create: 'তৈরি করুন', stories: 'স্টোরিজ', chat: 'চ্যাট',
    profile: 'প্রোফাইল', notifications: 'বিজ্ঞপ্তি', settings: 'সেটিংস', logout: 'লগআউট',
    login: 'লগইন', register: 'নিবন্ধন', email: 'ইমেইল', password: 'পাসওয়ার্ড',
    username: 'ব্যবহারকারীর নাম', signIn: 'সাইন ইন', signUp: 'সাইন আপ',
    createAccount: 'অ্যাকাউন্ট তৈরি করুন', alreadyHaveAccount: 'ইতিমধ্যে অ্যাকাউন্ট আছে?',
    dontHaveAccount: 'অ্যাকাউন্ট নেই?', post: 'পোস্ট', reel: 'রিল', reels: 'রিলস',
    like: 'লাইক', comment: 'মন্তব্য', share: 'শেয়ার', save: 'সংরক্ষণ', follow: 'ফলো',
    unfollow: 'আনফলো', following: 'ফলোয়িং', followers: 'ফলোয়ার', posts: 'পোস্ট',
    editProfile: 'প্রোফাইল সম্পাদনা', language: 'ভাষা', selectLanguage: 'ভাষা নির্বাচন',
    darkMode: 'ডার্ক মোড', lightMode: 'লাইট মোড', newPost: 'নতুন পোস্ট', newReel: 'নতুন রিল',
    newStory: 'নতুন স্টোরি', caption: 'ক্যাপশন', upload: 'আপলোড', uploadVideo: 'ভিডিও আপলোড',
    uploadImage: 'ছবি আপলোড', publish: 'প্রকাশ করুন', cancel: 'বাতিল',
    typeMessage: 'বার্তা টাইপ করুন...', noMessages: 'কোনো বার্তা নেই', online: 'অনলাইন',
    offline: 'অফলাইন', typing: 'টাইপ করছেন...', seen: 'দেখেছেন',
    adminPanel: 'অ্যাডমিন প্যানেল', dashboard: 'ড্যাশবোর্ড', users: 'ব্যবহারকারী', reports: 'রিপোর্ট',
    verified: 'যাচাইকৃত', pending: 'অপেক্ষমাণ', approve: 'অনুমোদন', reject: 'প্রত্যাখ্যান',
    delete: 'মুছুন', suspend: 'স্থগিত', block: 'ব্লক',
    noNotifications: 'কোনো বিজ্ঞপ্তি নেই', helpCenter: 'সহায়তা কেন্দ্র', reportProblem: 'সমস্যা রিপোর্ট',
    privacy: 'গোপনীয়তা', deleteAccount: 'অ্যাকাউন্ট মুছুন', verification: 'যাচাইকরণ',
    requestVerification: 'যাচাইকরণ অনুরোধ', submitted: 'জমা দেওয়া হয়েছে',
    views: 'ভিউ', welcomeBack: 'আবার স্বাগতম!', noPostsYet: 'এখনো পোস্ট নেই',
    noReelsYet: 'এখনো রিল নেই', noStoriesYet: 'এখনো স্টোরি নেই',
    fullName: 'পুরো নাম', bio: 'বায়ো', website: 'ওয়েবসাইট', save2: 'সংরক্ষণ করুন',
    mutualFollowsOnly: 'শুধু মিউচুয়াল ফলো', privateAccount: 'প্রাইভেট অ্যাকাউন্ট',
    broadcast: 'ব্রডকাস্ট', analytics: 'বিশ্লেষণ', contentModeration: 'কন্টেন্ট মডারেশন',
  },
  mr: {
    home: 'मुख्यपृष्ठ', search: 'शोधा', create: 'तयार करा', stories: 'स्टोरीज़', chat: 'गप्पा',
    profile: 'प्रोफाइल', notifications: 'सूचना', settings: 'सेटिंग्ज', logout: 'लॉगआउट',
    login: 'लॉगिन', register: 'नोंदणी', email: 'ईमेल', password: 'पासवर्ड',
    username: 'वापरकर्ता नाव', signIn: 'साइन इन', signUp: 'साइन अप',
    createAccount: 'खाते तयार करा', alreadyHaveAccount: 'आधीच खाते आहे?',
    dontHaveAccount: 'खाते नाही?', post: 'पोस्ट', reel: 'रील', reels: 'रील्स',
    like: 'आवडले', comment: 'टिप्पणी', share: 'शेअर', save: 'जतन', follow: 'फॉलो',
    unfollow: 'अनफॉलो', following: 'फॉलोइंग', followers: 'फॉलोअर्स', posts: 'पोस्ट',
    editProfile: 'प्रोफाइल संपादित करा', language: 'भाषा', selectLanguage: 'भाषा निवडा',
    darkMode: 'डार्क मोड', lightMode: 'लाईट मोड', newPost: 'नवीन पोस्ट', newReel: 'नवीन रील',
    newStory: 'नवीन स्टोरी', caption: 'कॅप्शन', upload: 'अपलोड', uploadVideo: 'व्हिडिओ अपलोड',
    uploadImage: 'फोटो अपलोड', publish: 'प्रकाशित करा', cancel: 'रद्द करा',
    typeMessage: 'संदेश टाइप करा...', noMessages: 'संदेश नाहीत', online: 'ऑनलाइन',
    offline: 'ऑफलाइन', typing: 'टाइप करत आहे...', seen: 'पाहिले',
    adminPanel: 'अॅडमिन पॅनेल', dashboard: 'डॅशबोर्ड', users: 'वापरकर्ते', reports: 'अहवाल',
    verified: 'सत्यापित', pending: 'प्रलंबित', approve: 'मंजूर', reject: 'नाकारा',
    delete: 'हटवा', suspend: 'निलंबित करा', block: 'ब्लॉक',
    noNotifications: 'सूचना नाहीत', helpCenter: 'मदत केंद्र', reportProblem: 'समस्या नोंदवा',
    privacy: 'गोपनीयता', deleteAccount: 'खाते हटवा', verification: 'सत्यापन',
    requestVerification: 'सत्यापन विनंती', submitted: 'सादर केले',
    views: 'व्ह्यूज', welcomeBack: 'पुन्हा स्वागत!', noPostsYet: 'अजून पोस्ट नाही',
    noReelsYet: 'अजून रील नाही', noStoriesYet: 'अजून स्टोरी नाही',
    fullName: 'पूर्ण नाव', bio: 'बायो', website: 'वेबसाइट', save2: 'जतन करा',
    mutualFollowsOnly: 'केवळ म्युचुअल फॉलोज', privateAccount: 'खाजगी खाते',
    broadcast: 'प्रसारण', analytics: 'विश्लेषण', contentModeration: 'सामग्री व्यवस्थापन',
  },
  gu: {
    home: 'હોમ', search: 'શોધો', create: 'બનાવો', stories: 'સ્ટોરીઝ', chat: 'ચેટ',
    profile: 'પ્રોફાઇલ', notifications: 'સૂચનાઓ', settings: 'સેટિંગ્સ', logout: 'લૉગ આઉટ',
    login: 'લૉગિન', register: 'નોંધણી', email: 'ઈમેઈલ', password: 'પાસવર્ડ',
    username: 'વપરાશકર્તા નામ', signIn: 'સાઇન ઇન', signUp: 'સાઇન અપ',
    createAccount: 'ખાતું બનાવો', alreadyHaveAccount: 'પહેલેથી ખાતું છે?',
    dontHaveAccount: 'ખાતું નથી?', post: 'પોસ્ટ', reel: 'રીલ', reels: 'રીલ્સ',
    like: 'લાઇક', comment: 'ટિપ્પણી', share: 'શેર', save: 'સેવ', follow: 'ફૉલો',
    unfollow: 'અનફૉલો', following: 'ફૉલોઇંગ', followers: 'ફૉલોઅર્સ', posts: 'પોસ્ટ',
    editProfile: 'પ્રોફાઇલ સંપાદિત કરો', language: 'ભાષા', selectLanguage: 'ભાષા પસંદ કરો',
    darkMode: 'ડાર્ક મોડ', lightMode: 'લાઇટ મોડ', newPost: 'નવી પોસ્ટ', newReel: 'નવી રીલ',
    newStory: 'નવી સ્ટોરી', caption: 'કૅપ્શન', upload: 'અપલોડ', uploadVideo: 'વિડિઓ અપલોડ',
    uploadImage: 'ફોટો અપલોડ', publish: 'પ્રકાશિત કરો', cancel: 'રદ કરો',
    typeMessage: 'સંદેશ ટાઇપ કરો...', noMessages: 'કોઈ સંદેશ નથી', online: 'ઑનલાઇન',
    offline: 'ઑફલાઇન', typing: 'ટાઇપ કરી રહ્યા છે...', seen: 'જોઈ લીધું',
    adminPanel: 'એડ્મિન પૅનલ', dashboard: 'ડૅશબૉર્ડ', users: 'વપરાશકર્તા', reports: 'અહેવાલ',
    verified: 'ચકાસાયેલ', pending: 'બાકી', approve: 'મંજૂર', reject: 'નકારો',
    delete: 'કાઢી નાખો', suspend: 'સસ્પેન્ડ', block: 'બ્લૉક',
    noNotifications: 'કોઈ સૂચના નથી', helpCenter: 'સહાય કેન્દ્ર', reportProblem: 'સમસ્યા નોંધો',
    privacy: 'ગોપનીયતા', deleteAccount: 'ખાતું કાઢો', verification: 'ચકાસણી',
    requestVerification: 'ચકાસણી માંગો', submitted: 'સબમિટ થઈ',
    views: 'વ્યૂ', welcomeBack: 'ફરી સ્વાગત!', noPostsYet: 'હજુ કોઈ પોસ્ટ નથી',
    noReelsYet: 'હજુ કોઈ રીલ નથી', noStoriesYet: 'હજુ કોઈ સ્ટોરી નથી',
    fullName: 'પૂરું નામ', bio: 'બાયો', website: 'વૅબસાઇટ', save2: 'સેવ કરો',
    mutualFollowsOnly: 'માત્ર મ્યૂચ્યૂઅલ ફૉલો', privateAccount: 'પ્રાઇવેટ ખાતું',
    broadcast: 'બ્રૉડકાસ્ટ', analytics: 'વિશ્લેષણ', contentModeration: 'સામગ્રી વ્યવસ્થાપન',
  },
  pa: {
    home: 'ਹੋਮ', search: 'ਖੋਜੋ', create: 'ਬਣਾਓ', stories: 'ਸਟੋਰੀਜ਼', chat: 'ਗੱਲਬਾਤ',
    profile: 'ਪ੍ਰੋਫਾਈਲ', notifications: 'ਸੂਚਨਾਵਾਂ', settings: 'ਸੈਟਿੰਗਜ਼', logout: 'ਲੌਗਆਉਟ',
    login: 'ਲੌਗਿਨ', register: 'ਰਜਿਸਟਰ', email: 'ਈਮੇਲ', password: 'ਪਾਸਵਰਡ',
    username: 'ਯੂਜ਼ਰਨੇਮ', signIn: 'ਸਾਈਨ ਇਨ', signUp: 'ਸਾਈਨ ਅੱਪ',
    createAccount: 'ਖਾਤਾ ਬਣਾਓ', alreadyHaveAccount: 'ਪਹਿਲਾਂ ਤੋਂ ਖਾਤਾ ਹੈ?',
    dontHaveAccount: 'ਖਾਤਾ ਨਹੀਂ?', post: 'ਪੋਸਟ', reel: 'ਰੀਲ', reels: 'ਰੀਲਜ਼',
    like: 'ਲਾਈਕ', comment: 'ਟਿੱਪਣੀ', share: 'ਸ਼ੇਅਰ', save: 'ਸੇਵ', follow: 'ਫੋਲੋ',
    unfollow: 'ਅਨਫੋਲੋ', following: 'ਫੋਲੋਇੰਗ', followers: 'ਫੋਲੋਅਰਜ਼', posts: 'ਪੋਸਟਾਂ',
    editProfile: 'ਪ੍ਰੋਫਾਈਲ ਸੋਧੋ', language: 'ਭਾਸ਼ਾ', selectLanguage: 'ਭਾਸ਼ਾ ਚੁਣੋ',
    darkMode: 'ਡਾਰਕ ਮੋਡ', lightMode: 'ਲਾਈਟ ਮੋਡ', newPost: 'ਨਵੀਂ ਪੋਸਟ', newReel: 'ਨਵੀਂ ਰੀਲ',
    newStory: 'ਨਵੀਂ ਸਟੋਰੀ', caption: 'ਕੈਪਸ਼ਨ', upload: 'ਅਪਲੋਡ', uploadVideo: 'ਵੀਡੀਓ ਅਪਲੋਡ',
    uploadImage: 'ਫੋਟੋ ਅਪਲੋਡ', publish: 'ਪ੍ਰਕਾਸ਼ਿਤ ਕਰੋ', cancel: 'ਰੱਦ ਕਰੋ',
    typeMessage: 'ਸੁਨੇਹਾ ਟਾਈਪ ਕਰੋ...', noMessages: 'ਕੋਈ ਸੁਨੇਹਾ ਨਹੀਂ', online: 'ਔਨਲਾਈਨ',
    offline: 'ਔਫਲਾਈਨ', typing: 'ਟਾਈਪ ਕਰ ਰਿਹਾ ਹੈ...', seen: 'ਦੇਖਿਆ',
    adminPanel: 'ਐਡਮਿਨ ਪੈਨਲ', dashboard: 'ਡੈਸ਼ਬੋਰਡ', users: 'ਯੂਜ਼ਰਜ਼', reports: 'ਰਿਪੋਰਟਾਂ',
    verified: 'ਤਸਦੀਕ ਕੀਤਾ', pending: 'ਲੰਬਿਤ', approve: 'ਮਨਜ਼ੂਰ', reject: 'ਰੱਦ ਕਰੋ',
    delete: 'ਮਿਟਾਓ', suspend: 'ਮੁਅੱਤਲ', block: 'ਬਲੌਕ',
    noNotifications: 'ਕੋਈ ਸੂਚਨਾ ਨਹੀਂ', helpCenter: 'ਮਦਦ ਕੇਂਦਰ', reportProblem: 'ਸਮੱਸਿਆ ਦੱਸੋ',
    privacy: 'ਗੋਪਨੀਯਤਾ', deleteAccount: 'ਖਾਤਾ ਮਿਟਾਓ', verification: 'ਤਸਦੀਕ',
    requestVerification: 'ਤਸਦੀਕ ਮੰਗੋ', submitted: 'ਜਮ੍ਹਾਂ ਕੀਤਾ',
    views: 'ਵਿਊਜ਼', welcomeBack: 'ਵਾਪਸ ਸੁਆਗਤ ਹੈ!', noPostsYet: 'ਅਜੇ ਕੋਈ ਪੋਸਟ ਨਹੀਂ',
    noReelsYet: 'ਅਜੇ ਕੋਈ ਰੀਲ ਨਹੀਂ', noStoriesYet: 'ਅਜੇ ਕੋਈ ਸਟੋਰੀ ਨਹੀਂ',
    fullName: 'ਪੂਰਾ ਨਾਮ', bio: 'ਬਾਇਓ', website: 'ਵੈੱਬਸਾਈਟ', save2: 'ਸੇਵ ਕਰੋ',
    mutualFollowsOnly: 'ਸਿਰਫ ਮਿਉਚੁਅਲ ਫੋਲੋ', privateAccount: 'ਪ੍ਰਾਈਵੇਟ ਖਾਤਾ',
    broadcast: 'ਪ੍ਰਸਾਰਣ', analytics: 'ਵਿਸ਼ਲੇਸ਼ਣ', contentModeration: 'ਸਮੱਗਰੀ ਪ੍ਰਬੰਧਨ',
  },
  ur: {
    home: 'ہوم', search: 'تلاش کریں', create: 'بنائیں', stories: 'کہانیاں', chat: 'چیٹ',
    profile: 'پروفائل', notifications: 'اطلاعات', settings: 'ترتیبات', logout: 'لاگ آؤٹ',
    login: 'لاگ ان', register: 'رجسٹر', email: 'ای میل', password: 'پاس ورڈ',
    username: 'صارف نام', signIn: 'سائن ان', signUp: 'سائن اپ',
    createAccount: 'اکاؤنٹ بنائیں', alreadyHaveAccount: 'پہلے سے اکاؤنٹ ہے؟',
    dontHaveAccount: 'اکاؤنٹ نہیں ہے؟', post: 'پوسٹ', reel: 'ریل', reels: 'ریلز',
    like: 'پسند', comment: 'تبصرہ', share: 'شیئر', save: 'محفوظ', follow: 'فالو',
    unfollow: 'ان فالو', following: 'فالوئنگ', followers: 'فالوئرز', posts: 'پوسٹس',
    editProfile: 'پروفائل ترمیم', language: 'زبان', selectLanguage: 'زبان منتخب کریں',
    darkMode: 'ڈارک موڈ', lightMode: 'لائٹ موڈ', newPost: 'نئی پوسٹ', newReel: 'نئی ریل',
    newStory: 'نئی کہانی', caption: 'کیپشن', upload: 'اپلوڈ', uploadVideo: 'ویڈیو اپلوڈ',
    uploadImage: 'تصویر اپلوڈ', publish: 'شائع کریں', cancel: 'منسوخ',
    typeMessage: 'پیغام ٹائپ کریں...', noMessages: 'کوئی پیغام نہیں', online: 'آن لائن',
    offline: 'آف لائن', typing: 'ٹائپ کر رہا ہے...', seen: 'دیکھا',
    adminPanel: 'ایڈمن پینل', dashboard: 'ڈیش بورڈ', users: 'صارفین', reports: 'رپورٹس',
    verified: 'تصدیق شدہ', pending: 'زیر التواء', approve: 'منظور', reject: 'مسترد',
    delete: 'حذف', suspend: 'معطل', block: 'بلاک',
    noNotifications: 'کوئی اطلاع نہیں', helpCenter: 'مدد مرکز', reportProblem: 'مسئلہ رپورٹ کریں',
    privacy: 'رازداری', deleteAccount: 'اکاؤنٹ حذف کریں', verification: 'تصدیق',
    requestVerification: 'تصدیق کی درخواست', submitted: 'جمع کرایا',
    views: 'ویوز', welcomeBack: 'واپسی پر خوش آمدید!', noPostsYet: 'ابھی کوئی پوسٹ نہیں',
    noReelsYet: 'ابھی کوئی ریل نہیں', noStoriesYet: 'ابھی کوئی کہانی نہیں',
    fullName: 'پورا نام', bio: 'بائیو', website: 'ویب سائٹ', save2: 'محفوظ کریں',
    mutualFollowsOnly: 'صرف میوچوئل فالو', privateAccount: 'نجی اکاؤنٹ',
    broadcast: 'نشریات', analytics: 'تجزیات', contentModeration: 'مواد کا انتظام',
  },
  kn: {
    home: 'ಮನೆ', search: 'ಹುಡುಕಿ', create: 'ರಚಿಸಿ', stories: 'ಕಥೆಗಳು', chat: 'ಚಾಟ್',
    profile: 'ಪ್ರೊಫೈಲ್', notifications: 'ಅಧಿಸೂಚನೆಗಳು', settings: 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು', logout: 'ಲಾಗ್ ಔಟ್',
    login: 'ಲಾಗಿನ್', register: 'ನೋಂದಣಿ', email: 'ಇಮೇಲ್', password: 'ಪಾಸ್‌ವರ್ಡ್',
    username: 'ಬಳಕೆದಾರ ಹೆಸರು', signIn: 'ಸೈನ್ ಇನ್', signUp: 'ಸೈನ್ ಅಪ್',
    createAccount: 'ಖಾತೆ ರಚಿಸಿ', alreadyHaveAccount: 'ಈಗಾಗಲೇ ಖಾತೆ ಇದೆಯೇ?',
    dontHaveAccount: 'ಖಾತೆ ಇಲ್ಲವೇ?', post: 'ಪೋಸ್ಟ್', reel: 'ರೀಲ್', reels: 'ರೀಲ್ಸ್',
    like: 'ಇಷ್ಟ', comment: 'ಕಾಮೆಂಟ್', share: 'ಹಂಚಿ', save: 'ಉಳಿಸಿ', follow: 'ಫಾಲೋ',
    unfollow: 'ಅನ್‌ಫಾಲೋ', following: 'ಫಾಲೋಯಿಂಗ್', followers: 'ಫಾಲೋವರ್ಸ್', posts: 'ಪೋಸ್ಟ್‌ಗಳು',
    editProfile: 'ಪ್ರೊಫೈಲ್ ತಿದ್ದಿ', language: 'ಭಾಷೆ', selectLanguage: 'ಭಾಷೆ ಆಯ್ಕೆ',
    darkMode: 'ಡಾರ್ಕ್ ಮೋಡ್', lightMode: 'ಲೈಟ್ ಮೋಡ್', newPost: 'ಹೊಸ ಪೋಸ್ಟ್', newReel: 'ಹೊಸ ರೀಲ್',
    newStory: 'ಹೊಸ ಸ್ಟೋರಿ', caption: 'ಶೀರ್ಷಿಕೆ', upload: 'ಅಪ್‌ಲೋಡ್', uploadVideo: 'ವೀಡಿಯೋ ಅಪ್‌ಲೋಡ್',
    uploadImage: 'ಫೋಟೋ ಅಪ್‌ಲೋಡ್', publish: 'ಪ್ರಕಟಿಸಿ', cancel: 'ರದ್ದು',
    typeMessage: 'ಸಂದೇಶ ಟೈಪ್ ಮಾಡಿ...', noMessages: 'ಸಂದೇಶಗಳಿಲ್ಲ', online: 'ಆನ್‌ಲೈನ್',
    offline: 'ಆಫ್‌ಲೈನ್', typing: 'ಟೈಪ್ ಮಾಡುತ್ತಿದ್ದಾರೆ...', seen: 'ನೋಡಿದರು',
    adminPanel: 'ಅಡ್ಮಿನ್ ಪ್ಯಾನೆಲ್', dashboard: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್', users: 'ಬಳಕೆದಾರರು', reports: 'ವರದಿಗಳು',
    verified: 'ಪರಿಶೀಲಿಸಲಾಗಿದೆ', pending: 'ಬಾಕಿ', approve: 'ಅನುಮೋದಿಸಿ', reject: 'ತಿರಸ್ಕರಿಸಿ',
    delete: 'ಅಳಿಸಿ', suspend: 'ಅಮಾನತು', block: 'ಬ್ಲಾಕ್',
    noNotifications: 'ಅಧಿಸೂಚನೆಗಳಿಲ್ಲ', helpCenter: 'ಸಹಾಯ ಕೇಂದ್ರ', reportProblem: 'ಸಮಸ್ಯೆ ತಿಳಿಸಿ',
    privacy: 'ಗೌಪ್ಯತೆ', deleteAccount: 'ಖಾತೆ ಅಳಿಸಿ', verification: 'ಪರಿಶೀಲನೆ',
    requestVerification: 'ಪರಿಶೀಲನೆ ಕೋರಿ', submitted: 'ಸಲ್ಲಿಸಲಾಗಿದೆ',
    views: 'ವೀಕ್ಷಣೆಗಳು', welcomeBack: 'ಮತ್ತೆ ಸ್ವಾಗತ!', noPostsYet: 'ಇನ್ನು ಪೋಸ್ಟ್‌ಗಳಿಲ್ಲ',
    noReelsYet: 'ಇನ್ನು ರೀಲ್‌ಗಳಿಲ್ಲ', noStoriesYet: 'ಇನ್ನು ಸ್ಟೋರಿಗಳಿಲ್ಲ',
    fullName: 'ಪೂರ್ಣ ಹೆಸರು', bio: 'ಬಯೋ', website: 'ವೆಬ್‌ಸೈಟ್', save2: 'ಉಳಿಸಿ',
    mutualFollowsOnly: 'ಮ್ಯೂಚುಯಲ್ ಫಾಲೋ ಮಾತ್ರ', privateAccount: 'ಖಾಸಗಿ ಖಾತೆ',
    broadcast: 'ಪ್ರಸಾರ', analytics: 'ವಿಶ್ಲೇಷಣೆ', contentModeration: 'ವಿಷಯ ನಿರ್ವಹಣೆ',
  },
};

interface LanguageContextType {
  lang: LangCode;
  setLang: (code: LangCode) => void;
  t: (key: TranslationKey) => string;
  currentLanguage: Language;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'hi',
  setLang: () => {},
  t: (key) => key,
  currentLanguage: LANGUAGES[0],
});

export const useLanguage = () => useContext(LanguageContext);

const STORAGE_KEY = 'ar_pixelgram_lang';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<LangCode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored as LangCode) || 'hi';
  });

  const setLang = (code: LangCode) => {
    setLangState(code);
    localStorage.setItem(STORAGE_KEY, code);
  };

  const t = (key: TranslationKey): string => {
    return translations[lang]?.[key] || translations['en']?.[key] || key;
  };

  const currentLanguage = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, currentLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};
