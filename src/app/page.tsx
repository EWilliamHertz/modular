import { query } from "@/lib/db";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import DraggableLessonList from "@/components/DraggableLessonList";
import AddLessonForm from "@/components/AddLessonForm";
import ProfileSettingsForm from "@/components/ProfileSettingsForm";
import CreateCourseForm from "@/components/CreateCourseForm";
import { auth, signIn, signOut } from "@/auth";

async function ensureDatabaseSchema() {
  'use server';
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Dynamic schema upgrades
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS portfolio_url VARCHAR(255);`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS resume_text TEXT;`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS show_resume BOOLEAN DEFAULT true;`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS show_portfolio BOOLEAN DEFAULT true;`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS portfolio_items JSONB DEFAULT '[]';`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS resume_pdf_data TEXT;`);
    
    await query(`
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        creator_id VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        is_published BOOLEAN DEFAULT FALSE,
        price_cents INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS image_url VARCHAR(255);`);
    await query(`
      CREATE TABLE IF NOT EXISTS lessons (
        id SERIAL PRIMARY KEY,
        course_id INT REFERENCES courses(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        content_json JSONB DEFAULT '{}',
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (err) {
    console.error("Error creating database schema tables:", err);
  }
}

// ------------------------------------------------------------------
// SECURE SERVER ACTIONS
// ------------------------------------------------------------------

async function updateProfileAction(formData: FormData) {
  'use server';
  const session = await auth();
  if (!session?.user?.email) return;

  const name = formData.get('name');
  const bio = formData.get('bio');
  const resumeText = formData.get('resume_text');
  
  const showResume = formData.get('show_resume') === 'true';
  const showPortfolio = formData.get('show_portfolio') === 'true';
  const portfolioItems = formData.get('portfolio_items') || '[]';
  const resumePdfData = formData.get('resume_pdf_data') || '';

  await query(`
    UPDATE users 
    SET name = $1, bio = $2, resume_text = $3, show_resume = $4, show_portfolio = $5, portfolio_items = $6, resume_pdf_data = $7
    WHERE email = $8
  `, [name, bio, resumeText, showResume, showPortfolio, portfolioItems, resumePdfData, session.user.email]);
  
  revalidatePath('/');
}

async function createCourseAction(formData: FormData) {
  'use server';
  const session = await auth();
  if (!session?.user?.email) return;

  const title = formData.get('title');
  const description = formData.get('description');
  const imageUrl = formData.get('image_url');
  const priceStr = formData.get('price');
  const priceCents = priceStr ? Math.round(parseFloat(priceStr as string) * 100) : 0;

  if (!title || !description) return;

  await query(`
    INSERT INTO courses (creator_id, title, description, is_published, price_cents, image_url)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [session.user.email, title, description, false, priceCents, imageUrl]);
  revalidatePath('/');
}

async function togglePublishAction(formData: FormData) {
  'use server';
  const session = await auth();
  if (!session?.user?.email) return;

  const courseId = formData.get('courseId');
  const currentStatus = formData.get('currentStatus') === 'true';

  await query('UPDATE courses SET is_published = $1 WHERE id = $2 AND creator_id = $3', [!currentStatus, courseId, session.user.email]);
  revalidatePath('/');
}

async function deleteCourseAction(formData: FormData) {
  'use server';
  const session = await auth();
  if (!session?.user?.email) return;

  const courseId = formData.get('courseId');
  await query('DELETE FROM courses WHERE id = $1 AND creator_id = $2', [courseId, session.user.email]);
  revalidatePath('/');
}

// ------------------------------------------------------------------
// MAIN PAGE COMPONENT
// ------------------------------------------------------------------

export default async function Home({ searchParams }: { searchParams: Promise<{ view?: string; authTab?: string; courseId?: string; email?: string; q?: string }> }) {
  const params = await searchParams;
  const session = await auth();
  const currentView = params.view || 'landing'; 
  const currentAuthTab = params.authTab || 'signin';
  const activeCourseId = params.courseId;
  const targetEmail = params.email;
  const searchQuery = params.q || '';

  await ensureDatabaseSchema();

  let catalogCourses: any[] = [];
  let myCourses: any[] = [];
  let activeCourse: any = null;
  let activeLessons: any[] = [];
  let userProfile: any = null;
  
  let profileUser: any = null;
  let profileCourses: any[] = [];
  
  // Search State
  let searchResults = { courses: [] as any[], users: [] as any[] };

  try {
    // 1. Fetch Active User Data (If logged in)
    if (session?.user?.email) {
      const userRes = await query('SELECT * FROM users WHERE email = $1', [session.user.email]);
      userProfile = userRes.rows[0];

      const myCoursesRes = await query('SELECT * FROM courses WHERE creator_id = $1 ORDER BY created_at DESC', [session.user.email]);
      myCourses = myCoursesRes.rows;
    }

    // 2. Fetch specific view data to prevent over-querying
    if (currentView === 'catalog' || currentView === 'landing') {
      const catalogRes = await query(`
        SELECT c.*, COALESCE(u.name, split_part(c.creator_id, '@', 1)) as author_name 
        FROM courses c 
        LEFT JOIN users u ON c.creator_id = u.email 
        WHERE c.is_published = true 
        ORDER BY c.created_at DESC
      `);
      catalogCourses = catalogRes.rows;
    }

    if (activeCourseId) {
      const courseRes = await query(`
        SELECT c.*, COALESCE(u.name, split_part(c.creator_id, '@', 1)) as author_name 
        FROM courses c 
        LEFT JOIN users u ON c.creator_id = u.email 
        WHERE c.id = $1
      `, [activeCourseId]);
      
      if (courseRes.rows.length > 0) {
        activeCourse = courseRes.rows[0];
        const lessonsRes = await query('SELECT * FROM lessons WHERE course_id = $1 ORDER BY sort_order ASC', [activeCourseId]);
        activeLessons = lessonsRes.rows;
      }
    }

    if (currentView === 'profile' && targetEmail) {
      const profileRes = await query('SELECT * FROM users WHERE email = $1', [targetEmail]);
      profileUser = profileRes.rows[0];
      if (profileUser) {
        const pcRes = await query('SELECT * FROM courses WHERE creator_id = $1 AND is_published = true ORDER BY created_at DESC', [targetEmail]);
        profileCourses = pcRes.rows;
      }
    }

    // 3. Search Executions
    if (currentView === 'search' && searchQuery) {
      const cRes = await query(`
        SELECT c.*, COALESCE(u.name, split_part(c.creator_id, '@', 1)) as author_name 
        FROM courses c 
        LEFT JOIN users u ON c.creator_id = u.email 
        WHERE c.is_published = true AND (c.title ILIKE $1 OR c.description ILIKE $1)
      `, [`%${searchQuery}%`]);
      searchResults.courses = cRes.rows;

      const uRes = await query(`SELECT * FROM users WHERE name ILIKE $1 OR bio ILIKE $1`, [`%${searchQuery}%`]);
      searchResults.users = uRes.rows;
    }
  } catch (error) {
    console.error('Database routing error:', error);
  }

  const isLoggedIn = !!session;

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-slate-900 selection:bg-indigo-500 selection:text-white pb-24 font-sans">
      
      {/* Dynamic Header Block with Global Search */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/?view=landing" className="flex items-center gap-2 font-bold text-xl tracking-tight text-slate-900 flex-shrink-0">
            <span className="bg-indigo-600 text-white w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm shadow-sm">μ</span>
            <span className="hidden sm:inline">Course<span className="text-indigo-600 font-medium">Builder</span></span>
          </Link>

     {/* Global Search Bar (No Icon, Right-Shifted Text) */}
          <form action="/" method="GET" className="flex-1 max-w-md mx-4 sm:mx-8 group">
            <input type="hidden" name="view" value="search" />
            <input 
              type="text" 
              name="q" 
              defaultValue={searchQuery}
              placeholder="Search courses, creators, portfolios..." 
              className="w-full bg-slate-100 border border-slate-200 rounded-full pl-8 pr-6 py-2 text-sm focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all shadow-sm group-hover:shadow-md" 
            />
          </form>     
          <div className="flex items-center gap-4 sm:gap-6 flex-shrink-0">
            {isLoggedIn ? (
              <>
                <Link href="/?view=catalog" className={`hidden sm:block text-sm font-medium transition ${currentView === 'catalog' ? 'text-indigo-600' : 'text-slate-600 hover:text-slate-900'}`}>Catalog</Link>
                <Link href="/?view=dashboard" className={`text-sm font-medium transition ${currentView === 'dashboard' ? 'text-indigo-600' : 'text-slate-600 hover:text-slate-900'}`}>Dashboard</Link>
                <Link href="/?view=settings" className={`text-sm font-medium transition ${currentView === 'settings' ? 'text-indigo-600' : 'text-slate-600 hover:text-slate-900'}`}>Settings</Link>
                <form action={async () => { 'use server'; await signOut({ redirectTo: '/' }); }}>
                  <button type="submit" className="hidden sm:block text-sm font-medium text-rose-600 hover:text-rose-700 transition ml-2 border-l border-slate-200 pl-4">Sign Out</button>
                </form>
              </>
            ) : (
              <>
                <Link href="/?view=auth&authTab=signin" className="hidden sm:block text-sm font-medium text-slate-600 hover:text-slate-900 transition">Sign In</Link>
                <Link href="/?view=auth&authTab=signup" className="rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-slate-800 transition">Get Started</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* VIEW: Gentle Landing Page */}
      {currentView === 'landing' && (
        <div className="relative isolate overflow-hidden">
          {/* Soft background aesthetic */}
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50/50 via-white to-white"></div>
          
          <div className="mx-auto max-w-7xl px-6 pt-24 pb-32 text-center lg:px-8">
            <div className="mx-auto max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50/80 border border-indigo-100 px-4 py-1.5 text-xs font-semibold text-indigo-700 mb-8 shadow-sm">
                A gentle space for learning and sharing 🌱
              </span>
              <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 sm:text-6xl mb-8 leading-tight">
                Empower your ideas. <br/>
                <span className="text-indigo-600 bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent">Build knowledge together.</span>
              </h1>
              <p className="text-lg leading-relaxed text-slate-600 max-w-2xl mx-auto mb-10">
                Welcome to a supportive platform designed for creators, educators, and lifelong learners. Effortlessly transform your expertise into structured micro-courses, showcase your professional portfolio, and connect with students at your own pace.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
                <Link href="/?view=auth&authTab=signup" className="w-full sm:w-auto rounded-full bg-slate-900 px-8 py-4 text-base font-bold text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 hover:scale-105 transition-all">
                  Start creating for free
                </Link>
                <Link href="/?view=catalog" className="w-full sm:w-auto rounded-full bg-white border border-slate-200 px-8 py-4 text-base font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-all">
                  Explore the Catalog
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: Search Results */}
      {currentView === 'search' && (
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="border-b border-slate-200 pb-8 mb-10">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Search Results</h1>
            <p className="text-slate-500 mt-2">Showing matches for "{searchQuery}"</p>
          </div>

          <div className="space-y-16">
            {/* User Matches */}
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md text-sm">{searchResults.users.length}</span>
                People & Portfolios
              </h2>
              {searchResults.users.length === 0 ? (
                <p className="text-slate-500 text-sm">No creators found matching that query.</p>
              ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {searchResults.users.map((user: any) => (
                    <Link href={`/?view=profile&email=${encodeURIComponent(user.email)}`} key={user.id} className="block bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-indigo-300 transition">
                       <h3 className="font-bold text-lg text-slate-900 mb-1">{user.name || user.email.split('@')[0]}</h3>
                       <p className="text-sm text-slate-500 line-clamp-2">{user.bio || 'Creator & Educator'}</p>
                       <div className="mt-4 text-indigo-600 text-sm font-semibold">View Profile →</div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* Course Matches */}
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md text-sm">{searchResults.courses.length}</span>
                Courses
              </h2>
              {searchResults.courses.length === 0 ? (
                <p className="text-slate-500 text-sm">No published courses found matching that query.</p>
              ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {searchResults.courses.map((course: any) => (
                    <Link href={`/?view=read&courseId=${course.id}`} key={course.id} className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md hover:border-indigo-300 transition cursor-pointer">
                      <div>
                        {course.image_url ? (
                          <img src={course.image_url} alt={course.title} className="w-full h-40 object-cover border-b border-slate-100" />
                        ) : (
                          <div className="w-full h-40 bg-gradient-to-br from-indigo-50 to-slate-100 flex items-center justify-center border-b border-slate-100">
                             <span className="text-indigo-200 font-black text-4xl">μ</span>
                          </div>
                        )}
                        <div className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">By {course.author_name}</span>
                            <span className="text-lg font-black text-indigo-600">${(course.price_cents / 100).toFixed(2)}</span>
                          </div>
                          <h3 className="text-lg font-bold text-slate-900 line-clamp-1 mb-2 group-hover:text-indigo-600 transition">{course.title}</h3>
                          <p className="text-sm text-slate-500 leading-relaxed line-clamp-3 mb-6">{course.description}</p>
                        </div>
                      </div>
                      <div className="px-6 pb-6 mt-auto font-semibold text-sm text-indigo-600 flex items-center gap-1 group-hover:gap-2 transition-all">Read Course →</div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* VIEW: Auth */}
      {currentView === 'auth' && (
        <div className="flex flex-col items-center justify-center pt-20 pb-24 px-6">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
            <div className="flex border-b border-slate-100 mb-8 p-1 bg-slate-100 rounded-xl">
              <Link href="/?view=auth&authTab=signin" className={`flex-1 text-center py-2 text-sm font-semibold rounded-lg transition-all ${currentAuthTab === 'signin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Sign In</Link>
              <Link href="/?view=auth&authTab=signup" className={`flex-1 text-center py-2 text-sm font-semibold rounded-lg transition-all ${currentAuthTab === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Create Account</Link>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 text-center mb-2">{currentAuthTab === 'signin' ? 'Welcome back' : 'Start your creator engine'}</h2>
            <p className="text-xs text-slate-500 text-center mb-6">{currentAuthTab === 'signin' ? 'Log into your administrator backend profile' : 'Set up parameters to start monetizing writing fragments'}</p>
           <form action={async (formData) => { 'use server'; await signIn('credentials', formData, { redirectTo: '/?view=dashboard' }); }} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1">Email Address</label>
                <input type="email" name="email" required placeholder="name@domain.com" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1">Password</label>
                <input type="password" name="password" required placeholder="••••••••" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition" />
              </div>
              <button type="submit" className="w-full mt-2 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-500 transition">
                {currentAuthTab === 'signin' ? 'Access Workspace Account' : 'Generate New Workspace'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* VIEW: Settings */}
      {currentView === 'settings' && userProfile && (
        <div className="mx-auto max-w-3xl px-6 py-12">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">Creator Profile & Portfolio</h1>
          <p className="text-sm text-slate-500 mb-8">Manage how you present your professional brand to your students.</p>
          
          <ProfileSettingsForm userProfile={userProfile} action={updateProfileAction} />
        </div>
      )}

      {/* VIEW: Public Author Profile */}
      {currentView === 'profile' && profileUser && (
        <div className="mx-auto max-w-4xl px-6 py-12">
          
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-10 mb-10 text-center">
            <h1 className="text-4xl font-black text-slate-900 mb-4">{profileUser.name || profileUser.email.split('@')[0]}</h1>
            <p className="text-lg text-slate-600 mb-6 max-w-2xl mx-auto">{profileUser.bio || 'Educator and creator.'}</p>
            <div className="flex items-center justify-center gap-4">
               <a href={`mailto:${profileUser.email}`} className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-full text-sm font-bold hover:bg-slate-200 transition shadow-sm">
                 Contact Me
               </a>
            </div>
          </div>

          <div className="space-y-16">
            
            {/* Conditional Resume Block */}
            {profileUser.show_resume && (profileUser.resume_pdf_data || profileUser.resume_text) && (
               <section>
                 <h3 className="font-bold text-slate-900 mb-6 text-2xl">The following is the resume from this person</h3>
                 <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                   {profileUser.resume_pdf_data ? (
                     <div className="flex flex-col items-center justify-center py-10">
                       <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-2xl flex items-center justify-center mb-4">
                         <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                       </div>
                       <h4 className="text-lg font-bold text-slate-900 mb-2">Professional Resume</h4>
                       <a href={profileUser.resume_pdf_data} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-rose-500 text-white px-6 py-2.5 rounded-full font-bold shadow-md hover:bg-rose-600 transition hover:-translate-y-0.5">
                         View PDF in New Tab ↗
                       </a>
                     </div>
                   ) : (
                     <div className="prose text-slate-600 whitespace-pre-wrap max-w-none">{profileUser.resume_text}</div>
                   )}
                 </div>
               </section>
            )}

            {/* Conditional Portfolio Block */}
            {profileUser.show_portfolio && profileUser.portfolio_items && (
               <section>
                 <h3 className="font-bold text-slate-900 mb-6 text-2xl">This person is an entrepreneur and has the following as his portfolio:</h3>
                 {(() => {
                   const items = typeof profileUser.portfolio_items === 'string' ? JSON.parse(profileUser.portfolio_items) : profileUser.portfolio_items;
                   if (items.length === 0) return <p className="text-slate-500 italic bg-slate-50 p-6 rounded-xl border border-slate-200">Portfolio is currently being updated.</p>;
                   
                   return (
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                       {items.map((item: any, idx: number) => (
                         <a key={idx} href={item.link} target="_blank" rel="noopener noreferrer" className="group block border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg transition hover:border-indigo-300 bg-white flex flex-col h-full">
                           {item.image ? (
                             <img src={item.image} alt={item.title} className="w-full h-48 object-cover border-b border-slate-100" />
                           ) : (
                             <div className="w-full h-48 bg-slate-100 flex items-center justify-center text-slate-400">No Image</div>
                           )}
                           <div className="p-6 flex-1 flex flex-col">
                             <h4 className="font-bold text-slate-900 text-lg mb-2 group-hover:text-indigo-600 transition">{item.title}</h4>
                             <p className="text-sm text-slate-600 mb-4 flex-1">{item.description}</p>
                             <div className="text-xs font-bold text-indigo-500 uppercase tracking-wider">Visit Project →</div>
                           </div>
                         </a>
                       ))}
                     </div>
                   );
                 })()}
               </section>
            )}

            {/* Author Courses */}
            <section>
              <h3 className="font-bold text-slate-900 mb-6 text-2xl border-b border-slate-200 pb-4">Courses Created</h3>
              {profileCourses.length === 0 ? (
                <p className="text-slate-500">This author has no published courses yet.</p>
              ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {profileCourses.map((course: any) => (
                    <Link href={`/?view=read&courseId=${course.id}`} key={course.id} className="group rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md hover:border-indigo-300 transition cursor-pointer flex flex-col justify-between">
                      <div>
                        {course.image_url ? (
                          <img src={course.image_url} alt={course.title} className="w-full h-40 object-cover border-b border-slate-100" />
                        ) : (
                          <div className="w-full h-40 bg-gradient-to-br from-indigo-50 to-slate-100 flex items-center justify-center border-b border-slate-100">
                             <span className="text-indigo-200 font-black text-4xl">μ</span>
                          </div>
                        )}
                        <div className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-lg font-black text-indigo-600">${(course.price_cents / 100).toFixed(2)}</span>
                          </div>
                          <h3 className="text-lg font-bold text-slate-900 line-clamp-1 mb-2 group-hover:text-indigo-600 transition">{course.title}</h3>
                          <p className="text-sm text-slate-500 leading-relaxed line-clamp-2 mb-4">{course.description}</p>
                        </div>
                      </div>
                      <div className="px-6 pb-6 mt-auto text-sm font-semibold text-indigo-600">Explore Curriculum →</div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* VIEW: Public Catalog */}
      {currentView === 'catalog' && (
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="border-b border-slate-200 pb-8 mb-10">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Course Catalog</h1>
            <p className="text-sm text-slate-500 mt-1">Discover micro-courses constructed by creators around the world.</p>
          </div>
          {catalogCourses.length === 0 ? (
             <div className="text-center py-12 text-slate-500">No courses have been published yet.</div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {catalogCourses.map((course: any) => (
                <div key={course.id} className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition">
                  <div>
                    {course.image_url ? (
                      <img src={course.image_url} alt={course.title} className="w-full h-40 object-cover border-b border-slate-100" />
                    ) : (
                      <div className="w-full h-40 bg-gradient-to-br from-indigo-50 to-slate-100 flex items-center justify-center border-b border-slate-100">
                         <span className="text-indigo-200 font-black text-4xl">μ</span>
                      </div>
                    )}
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <Link href={`/?view=profile&email=${encodeURIComponent(course.creator_id)}`} className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 hover:text-indigo-700 transition relative z-20">
                          By {course.author_name}
                        </Link>
                        <span className="text-lg font-black text-indigo-600">${(course.price_cents / 100).toFixed(2)}</span>
                      </div>
                      <Link href={`/?view=read&courseId=${course.id}`} className="block">
                        <h3 className="text-lg font-bold text-slate-900 line-clamp-1 mb-2 group-hover:text-indigo-600 transition">{course.title}</h3>
                        <p className="text-sm text-slate-500 leading-relaxed line-clamp-3 mb-6">{course.description}</p>
                      </Link>
                    </div>
                  </div>
                  <Link href={`/?view=read&courseId=${course.id}`} className="px-6 pb-6 mt-auto font-semibold text-sm text-indigo-600 flex items-center gap-1 group-hover:gap-2 transition-all block">Read Course →</Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW: Read Course */}
      {currentView === 'read' && activeCourse && (
        <div className="mx-auto max-w-3xl px-6 py-12">
          <Link href="/?view=catalog" className="text-sm text-slate-500 hover:text-indigo-600 mb-8 inline-block">← Back to Catalog</Link>
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-10 mb-10 text-center relative overflow-hidden">
            {!activeCourse.is_published && (
              <div className="absolute top-0 left-0 w-full bg-yellow-400 text-yellow-900 text-xs font-bold py-1">UNPUBLISHED DRAFT PREVIEW</div>
            )}
            <div className="mt-4">
              <Link href={`/?view=profile&email=${encodeURIComponent(activeCourse.creator_id)}`} className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-700 text-sm font-bold rounded-full mb-4 hover:bg-indigo-100 hover:text-indigo-900 transition">
                By {activeCourse.author_name}
              </Link>
              <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">{activeCourse.title}</h1>
              <p className="text-lg text-slate-600 max-w-xl mx-auto">{activeCourse.description}</p>
            </div>
          </div>

          <div className="space-y-8">
            {activeLessons.length === 0 ? (
              <p className="text-center text-slate-500 py-12">The creator has not published any lessons for this course yet.</p>
            ) : (
              activeLessons.map((lesson: any, index: number) => (
                <div key={lesson.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-slate-50 border-b border-slate-200 px-8 py-5 flex items-center gap-4">
                     <div className="bg-indigo-600 text-white font-black w-8 h-8 flex items-center justify-center rounded-full text-sm">{index + 1}</div>
                     <h2 className="text-xl font-bold text-slate-900">{lesson.title}</h2>
                  </div>
                  <div className="p-8 text-slate-700 leading-relaxed prose max-w-none" dangerouslySetInnerHTML={{ __html: lesson.content_json?.html || lesson.content_json?.text || "No content provided." }} />
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* VIEW: Course Editor */}
      {currentView === 'editor' && activeCourse && (
        <div className="mx-auto max-w-6xl px-6 py-12">
           <Link href="/?view=dashboard" className="text-sm text-slate-500 hover:text-indigo-600 mb-6 inline-block">← Back to Dashboard</Link>
           
           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10 border-b border-slate-200 pb-8">
             <div>
               <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Editing: {activeCourse.title}</h1>
               <p className="text-slate-600 max-w-2xl">{activeCourse.description}</p>
             </div>
             
             <div className="flex items-center gap-3">
               <Link href={`/?view=read&courseId=${activeCourse.id}`} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition">
                 Preview Reader
               </Link>
               <form action={togglePublishAction}>
                  <input type="hidden" name="courseId" value={activeCourse.id} />
                  <input type="hidden" name="currentStatus" value={activeCourse.is_published.toString()} />
                  <button type="submit" className={`px-4 py-2 text-sm font-bold rounded-xl shadow-sm transition ${activeCourse.is_published ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
                    {activeCourse.is_published ? '✓ Published (Click to Unpublish)' : 'Publish to Catalog'}
                  </button>
               </form>
             </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             <div className="lg:col-span-2 space-y-6">
                <h2 className="text-xl font-bold text-slate-900 border-b pb-2 mb-4">Course Curriculum</h2>
                <DraggableLessonList initialLessons={activeLessons} />
             </div>
             
             <div>
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm sticky top-24">
                  <h3 className="font-bold text-slate-900 mb-6 text-lg">Add New Lesson</h3>
                  <AddLessonForm courseId={activeCourse.id} />
                </div>
             </div>
           </div>
        </div>
      )}

      {/* VIEW: Creator Dashboard */}
      {currentView === 'dashboard' && (
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-8 mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Creator Hub Dashboard</h1>
              <p className="text-sm text-slate-500 mt-1">Manage your interactive courses and modules.</p>
            </div>
          </div>

          <div className="mb-10">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Create a New Course</h2>
            <CreateCourseForm action={createCourseAction} />
          </div>

          {myCourses.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-16 text-center">
              <div className="mx-auto w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 font-bold text-xl mb-4">ø</div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">No courses found</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">Use the form above to build and instantiate your very first micro-course!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {myCourses.map((course: any) => (
                <div key={course.id} className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition">
                  <div>
                    {course.image_url ? (
                      <img src={course.image_url} alt={course.title} className="w-full h-40 object-cover border-b border-slate-100" />
                    ) : (
                      <div className="w-full h-40 bg-gradient-to-br from-indigo-50 to-slate-100 flex items-center justify-center border-b border-slate-100">
                         <span className="text-indigo-200 font-black text-4xl">μ</span>
                      </div>
                    )}
                    <div className="p-6 pb-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${course.is_published ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10' : 'bg-slate-100 text-slate-600'}`}>
                          {course.is_published ? 'Published' : 'Draft'}
                        </span>
                        <span className="text-lg font-black text-slate-900">${(course.price_cents / 100).toFixed(2)}</span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 line-clamp-1 mb-2">{course.title}</h3>
                      <p className="text-sm text-slate-500 leading-relaxed line-clamp-3 mb-0">{course.description}</p>
                    </div>
                  </div>
                  <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex items-center justify-between text-xs mt-auto">
                    <Link href={`/?view=editor&courseId=${course.id}`} className="text-indigo-600 font-bold flex items-center gap-1 hover:gap-2 transition-all">Edit Course Builder →</Link>
                    <form action={deleteCourseAction}>
                      <input type="hidden" name="courseId" value={course.id} />
                      <button type="submit" className="text-rose-500 hover:text-rose-700 font-semibold transition">Delete</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}