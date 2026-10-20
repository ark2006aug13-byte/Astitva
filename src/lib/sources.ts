/**
 * Centralized Job Pool Sources Configuration
 * 6 Job Boards x Query Taxonomy of ~30 Role Templates
 */

export interface SourceDefinition {
  id: string;
  name: string;
  type: 'search' | 'api' | 'rss' | 'ats_career_pages';
  domain: string;
  defaultPortal: string;
}

export const JOB_SOURCES: SourceDefinition[] = [
  {
    id: 'linkedin_public',
    name: 'LinkedIn Public Search',
    type: 'search',
    domain: 'linkedin.com/jobs/view',
    defaultPortal: 'linkedin',
  },
  {
    id: 'wellfound',
    name: 'Wellfound (AngelList)',
    type: 'search',
    domain: 'wellfound.com/jobs',
    defaultPortal: 'custom',
  },
  {
    id: 'remotive',
    name: 'Remotive Remote Hub',
    type: 'api',
    domain: 'remotive.com/api/remote-jobs',
    defaultPortal: 'custom',
  },
  {
    id: 'himalayas',
    name: 'Himalayas Modern Careers',
    type: 'api',
    domain: 'himalayas.app/jobs',
    defaultPortal: 'custom',
  },
  {
    id: 'indeed_rss',
    name: 'Indeed RSS Feed',
    type: 'rss',
    domain: 'indeed.com/rss',
    defaultPortal: 'custom',
  },
  {
    id: 'top40_career_pages',
    name: 'Top 40 Enterprise Career Portals',
    type: 'ats_career_pages',
    domain: 'boards.greenhouse.io,jobs.lever.co,myworkdayjobs.com',
    defaultPortal: 'workday',
  },
];

export const TOP_40_COMPANIES = [
  { name: 'Stripe', domain: 'boards.greenhouse.io/stripe/jobs', portal: 'greenhouse', size: '5,000 - 10,000', industry: 'Financial Infrastructure', stack: ['Ruby', 'Go', 'TypeScript', 'React', 'Kubernetes'], baseSalary: [2800000, 5200000] },
  { name: 'Razorpay', domain: 'jobs.lever.co/razorpay', portal: 'lever', size: '2,000 - 5,000', industry: 'Fintech & Payments', stack: ['Go', 'TypeScript', 'PHP', 'Kafka', 'PostgreSQL'], baseSalary: [2200000, 4200000] },
  { name: 'Vercel', domain: 'boards.greenhouse.io/vercel/jobs', portal: 'greenhouse', size: '500 - 1,000', industry: 'Developer Experience & Cloud', stack: ['Next.js', 'React', 'TypeScript', 'Rust', 'Turbopack'], baseSalary: [3000000, 5600000] },
  { name: 'Microsoft', domain: 'microsoft.wd5.myworkdayjobs.com/careers', portal: 'workday', size: '100,000+', industry: 'Cloud & Enterprise Computing', stack: ['C#', 'TypeScript', 'Azure', 'Python', 'React'], baseSalary: [2400000, 4800000] },
  { name: 'Swiggy', domain: 'careers.swiggy.com/openings', portal: 'custom', size: '5,000 - 10,000', industry: 'Consumer Delivery & Quick Commerce', stack: ['Go', 'Java', 'Python', 'AWS', 'Redis'], baseSalary: [2000000, 3800000] },
  { name: 'Atlassian', domain: 'atlassian.wd3.myworkdayjobs.com/careers', portal: 'workday', size: '10,000+', industry: 'Collaboration & Productivity', stack: ['Java', 'TypeScript', 'React', 'AWS', 'GraphQL'], baseSalary: [2600000, 4800000] },
  { name: 'Coinbase', domain: 'boards.greenhouse.io/coinbase/jobs', portal: 'greenhouse', size: '3,000 - 5,000', industry: 'Crypto & Web3 Economy', stack: ['Go', 'Ruby', 'React', 'AWS', 'Docker'], baseSalary: [3200000, 6000000] },
  { name: 'Zepto', domain: 'jobs.lever.co/zepto', portal: 'lever', size: '1,000 - 3,000', industry: 'Instant Logistics & Commerce', stack: ['Python', 'Go', 'React Native', 'Kubernetes'], baseSalary: [1800000, 3600000] },
  { name: 'LinkedIn', domain: 'www.linkedin.com/jobs/view', portal: 'linkedin', size: '15,000+', industry: 'Professional Networking & Social', stack: ['Java', 'Kafka', 'TypeScript', 'GraphQL'], baseSalary: [2500000, 4500000] },
  { name: 'Datadog', domain: 'boards.greenhouse.io/datadog/jobs', portal: 'greenhouse', size: '5,000 - 10,000', industry: 'Observability & Cloud Monitoring', stack: ['Go', 'Python', 'React', 'Kafka', 'C++'], baseSalary: [2700000, 4900000] },
  { name: 'Uber', domain: 'uber.wd1.myworkdayjobs.com/careers', portal: 'workday', size: '25,000+', industry: 'Mobility & Distributed Tech', stack: ['Go', 'Java', 'Python', 'Kafka', 'Docker'], baseSalary: [2600000, 5000000] },
  { name: 'Postman', domain: 'boards.greenhouse.io/postman/jobs', portal: 'greenhouse', size: '1,000 - 2,000', industry: 'API Platform & Dev Tools', stack: ['Node.js', 'React', 'TypeScript', 'Electron'], baseSalary: [2300000, 4200000] },
  { name: 'CRED', domain: 'jobs.lever.co/cred', portal: 'lever', size: '500 - 1,000', industry: 'Premium FinTech', stack: ['Java', 'Go', 'Flutter', 'AWS', 'PostgreSQL'], baseSalary: [2500000, 4600000] },
  { name: 'Zomato', domain: 'careers.zomato.com/openings', portal: 'custom', size: '5,000+', industry: 'Food Tech & Logistics', stack: ['PHP', 'Go', 'Python', 'React', 'Kubernetes'], baseSalary: [2000000, 3800000] },
  { name: 'Flipkart', domain: 'flipkart.wd3.myworkdayjobs.com/careers', portal: 'workday', size: '30,000+', industry: 'E-Commerce Platform', stack: ['Java', 'Python', 'MySQL', 'Hadoop', 'Kafka'], baseSalary: [2200000, 4400000] },
  { name: 'Notion', domain: 'boards.greenhouse.io/notion/jobs', portal: 'greenhouse', size: '500 - 1,000', industry: 'Connected Workspace', stack: ['TypeScript', 'React', 'PostgreSQL', 'Kotlin'], baseSalary: [3200000, 5800000] },
  { name: 'Figma', domain: 'boards.greenhouse.io/figma/jobs', portal: 'greenhouse', size: '1,000 - 2,000', industry: 'Collaborative Interface Design', stack: ['TypeScript', 'Rust', 'C++', 'React', 'WebAssembly'], baseSalary: [3500000, 6200000] },
  { name: 'Linear', domain: 'jobs.ashbyhq.com/linear', portal: 'ashby', size: '50 - 200', industry: 'Issue Tracking & Project Management', stack: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'], baseSalary: [3400000, 6000000] },
  { name: 'Supabase', domain: 'jobs.lever.co/supabase', portal: 'lever', size: '100 - 500', industry: 'Open Source Backend Platform', stack: ['PostgreSQL', 'Go', 'TypeScript', 'Elixir'], baseSalary: [3000000, 5400000] },
  { name: 'Canva', domain: 'canva.wd3.myworkdayjobs.com/careers', portal: 'workday', size: '3,000 - 5,000', industry: 'Visual Communications Platform', stack: ['Java', 'TypeScript', 'React', 'AWS'], baseSalary: [2600000, 4800000] },
  { name: 'OpenAI', domain: 'boards.greenhouse.io/openai/jobs', portal: 'greenhouse', size: '1,000 - 2,000', industry: 'Artificial General Intelligence', stack: ['Python', 'Kubernetes', 'PyTorch', 'Rust', 'TypeScript'], baseSalary: [4000000, 8000000] },
  { name: 'Anthropic', domain: 'jobs.lever.co/anthropic', portal: 'lever', size: '500 - 1,000', industry: 'AI Safety & Large Models', stack: ['Python', 'Rust', 'Kubernetes', 'TypeScript'], baseSalary: [4000000, 8000000] },
  { name: 'Scale AI', domain: 'boards.greenhouse.io/scaleai/jobs', portal: 'greenhouse', size: '1,000 - 3,000', industry: 'AI Data Infrastructure', stack: ['Python', 'TypeScript', 'React', 'MongoDB'], baseSalary: [3000000, 5500000] },
  { name: 'Ramp', domain: 'jobs.ashbyhq.com/ramp', portal: 'ashby', size: '500 - 1,000', industry: 'Finance Automation & Cards', stack: ['Python', 'TypeScript', 'React', 'PostgreSQL'], baseSalary: [3200000, 5800000] },
  { name: 'Brex', domain: 'boards.greenhouse.io/brex/jobs', portal: 'greenhouse', size: '1,000 - 2,000', industry: 'Corporate Cards & Spend', stack: ['Elixir', 'Kotlin', 'TypeScript', 'PostgreSQL'], baseSalary: [3000000, 5400000] },
  { name: 'Rippling', domain: 'jobs.lever.co/rippling', portal: 'lever', size: '2,000 - 4,000', industry: 'Workforce Management & HR', stack: ['Python', 'Django', 'React', 'MongoDB'], baseSalary: [2800000, 5200000] },
  { name: 'Deel', domain: 'jobs.lever.co/deel', portal: 'lever', size: '2,000 - 4,000', industry: 'Global Payroll & Compliance', stack: ['Node.js', 'React', 'TypeScript', 'PostgreSQL'], baseSalary: [2800000, 5000000] },
  { name: 'Cloudflare', domain: 'boards.greenhouse.io/cloudflare/jobs', portal: 'greenhouse', size: '3,000 - 5,000', industry: 'Edge Compute & Web Security', stack: ['Rust', 'Go', 'TypeScript', 'Linux', 'C++'], baseSalary: [3200000, 5800000] },
  { name: 'Snowflake', domain: 'snowflake.wd1.myworkdayjobs.com/careers', portal: 'workday', size: '5,000 - 10,000', industry: 'Data Cloud & Warehousing', stack: ['Java', 'C++', 'Go', 'Python', 'AWS'], baseSalary: [3000000, 5600000] },
  { name: 'GitHub', domain: 'boards.greenhouse.io/github/jobs', portal: 'greenhouse', size: '3,000 - 5,000', industry: 'Developer Code Collaboration', stack: ['Ruby', 'Go', 'TypeScript', 'MySQL'], baseSalary: [2800000, 5200000] },
  { name: 'GitLab', domain: 'boards.greenhouse.io/gitlab/jobs', portal: 'greenhouse', size: '2,000 - 3,000', industry: 'DevSecOps Platform', stack: ['Ruby', 'Go', 'Vue.js', 'PostgreSQL'], baseSalary: [2800000, 5000000] },
  { name: 'Spotify', domain: 'spotify.wd3.myworkdayjobs.com/careers', portal: 'workday', size: '8,000+', industry: 'Audio Streaming & Podcasting', stack: ['Java', 'Python', 'C++', 'GCP', 'Kafka'], baseSalary: [2800000, 5200000] },
  { name: 'Shopify', domain: 'shopify.wd3.myworkdayjobs.com/careers', portal: 'workday', size: '10,000+', industry: 'Global E-Commerce OS', stack: ['Ruby', 'React', 'TypeScript', 'MySQL'], baseSalary: [2900000, 5400000] },
  { name: 'Wise', domain: 'boards.greenhouse.io/wise/jobs', portal: 'greenhouse', size: '5,000+', industry: 'International Money Transfer', stack: ['Java', 'Spring', 'TypeScript', 'Kafka'], baseSalary: [2500000, 4800000] },
  { name: 'Revolut', domain: 'jobs.lever.co/revolut', portal: 'lever', size: '8,000+', industry: 'Global SuperApp & Neobank', stack: ['Java', 'Python', 'React', 'PostgreSQL'], baseSalary: [2600000, 4900000] },
  { name: 'Google', domain: 'careers.google.com/jobs/results', portal: 'custom', size: '150,000+', industry: 'Search, Cloud & Computing', stack: ['C++', 'Java', 'Python', 'Go', 'TypeScript'], baseSalary: [3000000, 6500000] },
  { name: 'Amazon', domain: 'amazon.jobs/en/search', portal: 'custom', size: '1,000,000+', industry: 'E-Commerce & AWS Cloud', stack: ['Java', 'Python', 'C++', 'AWS', 'Distributed'], baseSalary: [2600000, 5500000] },
  { name: 'Netflix', domain: 'jobs.netflix.com/search', portal: 'custom', size: '12,000+', industry: 'Streaming & Media Infrastructure', stack: ['Java', 'Node.js', 'React', 'AWS', 'Kafka'], baseSalary: [3500000, 7500000] },
  { name: 'Meta', domain: 'metacareers.com/jobs', portal: 'custom', size: '60,000+', industry: 'Social Networks & AI', stack: ['Python', 'C++', 'Hack', 'React', 'PyTorch'], baseSalary: [3200000, 6800000] },
  { name: 'Apple', domain: 'jobs.apple.com/en-us/search', portal: 'custom', size: '150,000+', industry: 'Consumer Electronics & Platforms', stack: ['Swift', 'Objective-C', 'C++', 'Python'], baseSalary: [3000000, 6200000] },
];

/**
 * Query taxonomy of 30 role templates combined with location variants
 */
export const ROLE_QUERY_TAXONOMY: string[] = [
  'frontend engineer remote',
  'backend engineer India',
  'full stack engineer remote',
  'data analyst remote',
  'product designer remote',
  'devops engineer India',
  'ml engineer remote',
  'distributed systems engineer',
  'staff software engineer Bengaluru',
  'senior frontend developer',
  'cloud infrastructure architect',
  'site reliability engineer SRE',
  'ios developer remote',
  'android engineer remote',
  'qa automation engineer',
  'security engineer remote',
  'engineering manager Bengaluru',
  'technical product manager',
  'ai research engineer',
  'platform engineer remote',
  'data engineer India',
  'systems engineer remote',
  'embedded software engineer',
  'solutions architect India',
  'rust engineer remote',
  'golang backend engineer',
  'react developer remote',
  'python backend developer',
  'database administrator remote',
  'growth software engineer',
];

// Persistent round-robin index state
let roundRobinIndex = 0;

/**
 * Picks queries for an ingestion run, ensuring the full taxonomy refreshes every 24h
 */
export function pickIngestionQueries(batchSize = 6): { queries: string[]; nextIndex: number } {
  const selected: string[] = [];
  const total = ROLE_QUERY_TAXONOMY.length;

  for (let i = 0; i < batchSize; i++) {
    const idx = (roundRobinIndex + i) % total;
    selected.push(ROLE_QUERY_TAXONOMY[idx]);
  }

  roundRobinIndex = (roundRobinIndex + batchSize) % total;
  return { queries: selected, nextIndex: roundRobinIndex };
}

/**
 * Bundled high-fidelity fixture source adapter for fallback & test stability
 */
export function generateFixturePoolBatch(
  query: string,
  targetCount = 15
): Array<{
  title: string;
  company: string;
  location: string;
  is_remote: boolean;
  salary_min: number;
  salary_max: number;
  salary_raw: string;
  jd_text: string;
  url: string;
  portal_type: string;
  posted_at: string;
  source: string;
}> {
  const jobs: any[] = [];
  const queryLower = query.toLowerCase();

  for (let i = 0; i < targetCount; i++) {
    const comp = TOP_40_COMPANIES[(i + Math.abs(query.length)) % TOP_40_COMPANIES.length];
    const isRemote = queryLower.includes('remote') || i % 2 === 0;
    const location = isRemote ? 'Remote' : (i % 3 === 0 ? 'Bengaluru, India' : 'San Francisco, CA');

    let titlePrefix = i % 4 === 0 ? 'Senior ' : i % 4 === 1 ? 'Staff ' : i % 4 === 2 ? 'Principal ' : 'Lead ';
    let baseRole = 'Software Engineer';
    if (queryLower.includes('frontend')) baseRole = 'Frontend Engineer';
    else if (queryLower.includes('backend')) baseRole = 'Backend Systems Engineer';
    else if (queryLower.includes('data')) baseRole = 'Data Platform Engineer';
    else if (queryLower.includes('devops') || queryLower.includes('sre')) baseRole = 'DevOps / SRE Architect';
    else if (queryLower.includes('ml') || queryLower.includes('ai')) baseRole = 'Machine Learning Engineer';
    else if (queryLower.includes('product')) baseRole = 'Product Engineering Lead';

    const jobTitle = `${titlePrefix}${baseRole}`;
    const daysAgo = Math.floor(Math.random() * 8) + 1; // 1-8 days ago
    const postedAt = new Date(Date.now() - daysAgo * 86400000).toISOString();

    const minSal = comp.baseSalary[0];
    const maxSal = comp.baseSalary[1];
    const salRaw = `₹${(minSal / 100000).toFixed(1)} - ₹${(maxSal / 100000).toFixed(1)} LPA`;

    const jdText = `About ${comp.name}:
We are looking for an exceptional ${jobTitle} to join our ${location} organization. ${comp.name} is a global leader in ${comp.industry}.

Role Responsibilities:
• Architect, build, and deploy mission-critical distributed services and microservices.
• Drive code reliability, automated test coverage, and continuous deployment pipelines.
• Collaborate closely with cross-functional product and infrastructure teams.
• Elevate team standards through empathetic code reviews and architecture discussions.

Required Skills & Experience:
• 4+ years software development experience with ${comp.stack.slice(0, 3).join(', ')}.
• Demonstrated mastery in ${comp.stack[3] || 'PostgreSQL'} and distributed caching (${comp.stack[4] || 'Redis'}).
• Solid understanding of high-availability cloud architecture and automated CI/CD.
• Passion for building intuitive, high-performance systems with modern developer tooling.

Benefits & Compensation:
• Target Base: ${salRaw} plus generous equity participation.
• Comprehensive health and mental wellness coverage.
• Flexible work stipends, annual learning budget, and generous paid time off.`;

    const jobIdNum = 100000 + ((i * 37 + query.length) % 900000);
    const url = `https://${comp.domain}/${jobIdNum}`;

    jobs.push({
      title: jobTitle,
      company: comp.name,
      location,
      is_remote: isRemote,
      salary_min: minSal,
      salary_max: maxSal,
      salary_raw: salRaw,
      jd_text: jdText,
      url,
      portal_type: comp.portal,
      posted_at: postedAt,
      source: 'Centralized Source Matrix',
    });
  }

  return jobs;
}
