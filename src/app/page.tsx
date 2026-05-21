import { query } from "@/lib/db";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import DraggableLessonList from "@/components/DraggableLessonList";
import RichTextEditor from "@/components/RichTextEditor";
import { auth, signIn, signOut } from "@/auth";

// Server-side initialization action to ensure Neon schema tables exist
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
    await query(`
      CREATE TABLE IF NOT EXISTS course_enrollments (
        id SERIAL PRIMARY KEY,
        student_id VARCHAR(255) NOT NULL,
        course_id INT REFERENCES courses(id) ON DELETE CASCADE,
        stripe_customer_id VARCHAR(255),
        stripe_subscription_id VARCHAR(255),
        completed_lessons JSONB DEFAULT '[]',
        enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (err) {
    console.error("Error creating database schema tables:", err);
  }
}

// Server Action to delete a course and securely cascade delete its lessons
async function deleteCourseAction(formData: FormData) {
  'use server';
  const courseId = formData.get('courseId');
  if (!courseId) return;

  try {
    await query('DELETE FROM courses WHERE id = $1', [courseId]);
    revalidatePath('/');
  } catch (error) {
    console.error('Error deleting course:', error);
  }
}

// Server Action to create a custom user course securely linked to Auth session
async function createCourseAction(formData: FormData) {
  'use server';
  const session = await auth();
  if (!session || !session.user?.email) return;

  const title = formData.get('title');
  const description = formData.get('description');
  const priceStr = formData.get('price');
  const priceCents = priceStr ? Math.round(parseFloat(priceStr as string) * 100) : 0;

  if (!title || !description) return;

  try {
    await ensureDatabaseSchema();
    await query(`
      INSERT INTO courses (creator_id, title, description, is_published, price_cents)
      VALUES ($1, $2, $3, $4, $5)
    `, [session.user.email, title, description, false, priceCents]);
    revalidatePath('/');
  } catch (error) {
    console.error('Error creating user course:', error);
  }
}

// New Server Action to create lessons securely inside the Neon database
async function createLessonAction(formData: FormData) {
  'use server';
  const courseId = formData.get('courseId');
  const title = formData.get('title');
  const content = formData.get('content');

  if (!courseId || !title) return;

  try {
    await query(`
      INSERT INTO lessons (course_id, title, content_json, sort_order)
      VALUES ($1, $2, $3, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM lessons WHERE course_id = $1))
    `, [courseId, title, JSON.stringify({ html: content })]);
    revalidatePath('/');
  } catch (error) {
    console.error('Error adding lesson:', error);
  }
}

export default async function Home({ searchParams }: { searchParams: Promise<{ view?: string; authTab?: string; courseId?: string }> }) {
  const params = await searchParams;
  const session = await auth();
  const currentView = params.view || (session ? 'dashboard' : 'landing'); 
  const currentAuthTab = params.authTab || 'signin';
  const activeCourseId = params.courseId;

  // Attempt database synchronization prior to initial rendering layout
  await ensureDatabaseSchema();

  let allCourses: any[] = [];
  let activeCourse: any = null;
  let activeLessons: any[] = [];
  let dbError = false;

  try {
    const result = await query('SELECT * FROM courses ORDER BY created_at DESC');
    allCourses = result.rows;

    // If viewing or editing a specific course, fetch its metadata and sequential lessons
    if (activeCourseId) {
      const courseRes = await query('SELECT * FROM courses WHERE id = $1', [activeCourseId]);
      if (courseRes.rows.length > 0) {
        activeCourse = courseRes.rows[0];
        const lessonsRes = await query('SELECT * FROM lessons WHERE course_id = $1 ORDER BY sort_order ASC', [activeCourseId]);
        activeLessons = lessonsRes.rows;
      }
    }
  } catch (error) {
    console.error('Failed to read live table state:', error);
    dbError = true;
  }

  // Use the verified NextAuth session
  const isLoggedIn = !!session;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-500 selection:text-white">
      {/* Dynamic Header Block */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href={isLoggedIn ? "/?view=catalog" : "/?view=landing"} className="flex items-center gap-2 font-bold text-xl tracking-tight text-slate-900">
            <span className="bg-indigo-600 text-white w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm shadow-sm">μ</span>
            <span>Course<span className="text-indigo-600 font-medium">Builder</span></span>
          </Link>
          
          <div className="flex items-center gap-6">
            {isLoggedIn ? (
              <>
                <Link href="/?view=catalog" className={`text-sm font-medium transition ${currentView === 'catalog' ? 'text-indigo-600' : 'text-slate-600 hover:text-slate-900'}`}>
                  Catalog
                </Link>
                <Link href="/?view=dashboard" className={`text-sm font-medium transition ${currentView === 'dashboard' ? 'text-indigo-600' : 'text-slate-600 hover:text-slate-900'}`}>
                  Dashboard
                </Link>
                <form action={async () => { 'use server'; await signOut({ redirectTo: '/' }); }}>
                  <button type="submit" className="text-sm font-medium text-rose-600 hover:text-rose-700 transition ml-4 border-l border-slate-200 pl-4">
                    Sign Out
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/?view=auth&authTab=signin" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition">
                  Sign In
                </Link>
                <Link href="/?view=auth&authTab=signup" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Render Perspective View: Landing Page */}
      {currentView === 'landing' && (
        <div className="relative isolate overflow-hidden">
          <div className="mx-auto max-w-7xl px-6 pt-20 pb-24 text-center sm:pt-28 lg:px-8">
            <div className="mx-auto max-w-3xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-700/10 mb-6 animate-fade-in">
                Next.js + Neon Serverless SQL Stack
              </span>
              <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
                Turn audience content into <span className="text-indigo-600 bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent">interactive micro-courses</span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-slate-600 max-w-2xl mx-auto">
                Repurpose your blog posts, technical essays, or social threads into structured modular learning systems. Complete with rich-text builders, JSON progress tracking, and Stripe monetizations.
              </p>
              <div className="mt-10 flex items-center justify-center gap-x-6">
                <Link href="/?view=auth&authTab=signup" className="rounded-xl bg-slate-900 px-5 py-3 text-base font-semibold text-white shadow-md hover:bg-slate-800 transition">
                  Build a Course Free
                </Link>
                <Link href="/?view=dashboard" className="text-base font-semibold leading-6 text-slate-900 hover:text-indigo-600 transition flex items-center gap-1">
                  View Live Creator Sandbox →
                </Link>
              </div>
            </div>

            {/* Feature Highlights Grid */}
            <div className="mx-auto mt-24 max-w-5xl sm:mt-32">
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-left shadow-sm">
                  <div className="font-bold text-lg text-slate-900 mb-2">Drag-and-Drop Structure</div>
                  <p className="text-sm text-slate-600 leading-relaxed">Arrange lesson paths quickly. Store flexible rich layouts seamlessly using Postgres JSONB schemas.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-left shadow-sm">
                  <div className="font-bold text-lg text-slate-900 mb-2">Stripe Access Control</div>
                  <p className="text-sm text-slate-600 leading-relaxed">Gate premium tiers safely. Block unauthorized requests natively inside scalable serverless edge routing.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-left shadow-sm">
                  <div className="font-bold text-lg text-slate-900 mb-2">Neon Serverless Scale</div>
                  <p className="text-sm text-slate-600 leading-relaxed">Instant bottomless connections that autoscale down to absolute zero when traffic is low.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Render Perspective View: Dual-Tab Authentication Block */}
      {currentView === 'auth' && (
        <div className="flex flex-col items-center justify-center pt-20 pb-24 px-6">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
            <div className="flex border-b border-slate-100 mb-8 p-1 bg-slate-100 rounded-xl">
              <Link 
                href="/?view=auth&authTab=signin" 
                className={`flex-1 text-center py-2 text-sm font-semibold rounded-lg transition-all ${currentAuthTab === 'signin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Sign In
              </Link>
              <Link 
                href="/?view=auth&authTab=signup" 
                className={`flex-1 text-center py-2 text-sm font-semibold rounded-lg transition-all ${currentAuthTab === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Create Account
              </Link>
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-slate-900 text-center mb-2">
              {currentAuthTab === 'signin' ? 'Welcome back' : 'Start your creator engine'}
            </h2>
            <p className="text-xs text-slate-500 text-center mb-6">
              {currentAuthTab === 'signin' ? 'Log into your administrator backend profile' : 'Set up parameters to start monetizing writing fragments'}
            </p>

           <form action={async (formData) => {
             'use server';
             await signIn('credentials', formData, { redirectTo: '/?view=dashboard' });
           }} className="space-y-4">
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

      {/* Render Perspective View: Public Course Catalog */}
      {currentView === 'catalog' && (
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="border-b border-slate-200 pb-8 mb-10">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Course Catalog</h1>
            <p className="text-sm text-slate-500 mt-1">Discover micro-courses constructed by creators around the world.</p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {allCourses.map((course: any) => (
              <Link href={`/?view=read&courseId=${course.id}`} key={course.id} className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-indigo-300 transition cursor-pointer">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                      Author: {course.creator_id}
                    </span>
                    <span className="text-lg font-black text-indigo-600">${(course.price_cents / 100).toFixed(2)}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 line-clamp-1 mb-2 group-hover:text-indigo-600 transition">{course.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed line-clamp-3 mb-6">{course.description}</p>
                </div>
                <div className="mt-4 font-semibold text-sm text-indigo-600 flex items-center gap-1 group-hover:gap-2 transition-all">
                  Read Course →
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Render Perspective View: Read Course Content */}
      {currentView === 'read' && activeCourse && (
        <div className="mx-auto max-w-3xl px-6 py-12">
          <Link href="/?view=catalog" className="text-sm text-slate-500 hover:text-indigo-600 mb-8 inline-block">← Back to Catalog</Link>
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-10 mb-10 text-center">
            <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full mb-4">Course Preview</span>
            <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">{activeCourse.title}</h1>
            <p className="text-lg text-slate-600 max-w-xl mx-auto">{activeCourse.description}</p>
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

      {/* Render Perspective View: Course Builder Editor */}
      {currentView === 'editor' && activeCourse && (
        <div className="mx-auto max-w-6xl px-6 py-12">
           <Link href="/?view=dashboard" className="text-sm text-slate-500 hover:text-indigo-600 mb-6 inline-block">← Back to Dashboard</Link>
           <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Editing: {activeCourse.title}</h1>
           <p className="text-slate-600 mb-10 max-w-2xl">{activeCourse.description}</p>

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             <div className="lg:col-span-2 space-y-6">
                <h2 className="text-xl font-bold text-slate-900 border-b pb-2 mb-4">Course Curriculum</h2>
                <DraggableLessonList initialLessons={activeLessons} />
             </div>
             
             <div>
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm sticky top-24">
                  <h3 className="font-bold text-slate-900 mb-6 text-lg">Add New Lesson</h3>
                  <form action={createLessonAction} className="space-y-5">
                    <input type="hidden" name="courseId" value={activeCourse.id} />
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">Lesson Title</label>
                      <input type="text" name="title" required placeholder="e.g. Introduction to logic" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-500 outline-none transition" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">Lesson Content</label>
                      <RichTextEditor name="content" />
                    </div>
                    <button type="submit" className="w-full bg-indigo-600 text-white rounded-xl py-3 text-sm font-bold shadow-sm hover:bg-indigo-500 transition">Save Lesson Record</button>
                  </form>
                </div>
             </div>
           </div>
        </div>
      )}

      {/* Render Perspective View: Database Course Dashboard Workspace */}
      {currentView === 'dashboard' && (
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-8 mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Creator Hub Dashboard</h1>
              <p className="text-sm text-slate-500 mt-1">Manage your interactive courses and modules.</p>
            </div>
          </div>

          {/* Course Creation Form Widget */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-10">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Create a New Course</h2>
            <form action={createCourseAction} className="flex flex-col sm:flex-row gap-4 items-end">
               <div className="flex-1 w-full">
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">Course Title</label>
                  <input type="text" name="title" required placeholder="e.g. Next.js App Router Masterclass" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-500 outline-none transition" />
               </div>
               <div className="flex-1 w-full">
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">Short Description</label>
                  <input type="text" name="description" required placeholder="What will students learn in this course?" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-500 outline-none transition" />
               </div>
               <div className="w-full sm:w-32">
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">Price ($)</label>
                  <input type="number" name="price" step="0.01" min="0" required placeholder="29.00" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-500 outline-none transition" />
               </div>
               <button type="submit" className="w-full sm:w-auto bg-indigo-600 text-white rounded-xl px-6 py-2.5 text-sm font-bold shadow-sm hover:bg-indigo-500 transition h-[42px]">
                 Create
               </button>
            </form>
          </div>

          {dbError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-6 text-rose-800">
              <h3 className="font-bold mb-1 text-base">Neon Data Processing Connection Fault</h3>
              <p className="text-sm text-rose-700">Unable to accurately verify data matrices. Verify your system environment keys in `.env.local` are complete.</p>
            </div>
          ) : allCourses.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-16 text-center">
              <div className="mx-auto w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 font-bold text-xl mb-4">ø</div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">No courses found</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">Use the form above to build and instantiate your very first micro-course!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {allCourses.map((course: any) => (
                <div key={course.id} className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                        {course.is_published ? 'Published' : 'Draft'}
                      </span>
                      <span className="text-lg font-black text-slate-900">${(course.price_cents / 100).toFixed(2)}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 line-clamp-1 mb-2">{course.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed line-clamp-3 mb-6">{course.description}</p>
                  </div>
                  <div className="border-t border-slate-100 pt-4 flex items-center justify-between text-xs">
                    <Link href={`/?view=editor&courseId=${course.id}`} className="text-indigo-600 font-bold flex items-center gap-1 hover:gap-2 transition-all">
                      Edit Course Builder →
                    </Link>
                    <form action={deleteCourseAction}>
                      <input type="hidden" name="courseId" value={course.id} />
                      <button type="submit" className="text-rose-500 hover:text-rose-700 font-semibold transition">
                        Delete
                      </button>
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