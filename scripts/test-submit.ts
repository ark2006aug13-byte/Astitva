async function testSubmit() {
  const form = new FormData();
  form.append('fullName', 'Aryan Raj');
  form.append('email', 'aryan.raj@example.com');
  form.append('phone', '+919876543210');
  form.append('targetRole', 'AI Software Engineer');
  form.append('skills', 'TypeScript, Node.js, Python, Supabase');
  form.append('notes', 'Looking for remote AI agent roles');

  // Attach a sample PDF
  const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
  form.append('resume', new Blob([pdfBytes], { type: 'application/pdf' }), 'aryan_resume.pdf');

  const res = await fetch('http://localhost:4000/api/v1/supabase/submit', {
    method: 'POST',
    body: form,
  });

  console.log('Status Code:', res.status);
  const data = await res.json();
  console.log('Response:', data);

  process.exit(0);
}

testSubmit();
