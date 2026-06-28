let isLoginMode = true;

const authTitle = document.getElementById('authTitle');
const submitBtn = document.getElementById('submitBtn');
const toggleAuth = document.getElementById('toggleAuth');
const authForm = document.getElementById('authForm');
const errorMsg = document.getElementById('errorMsg');

toggleAuth.addEventListener('click', () => {
  isLoginMode = !isLoginMode;
  if (isLoginMode) {
    authTitle.textContent = 'Login to AI Ops';
    submitBtn.innerHTML = 'Authenticate <span class="material-symbols-outlined text-sm">login</span>';
    toggleAuth.textContent = 'Need an account? Register here.';
  } else {
    authTitle.textContent = 'Create an Account';
    submitBtn.innerHTML = 'Register <span class="material-symbols-outlined text-sm">person_add</span>';
    toggleAuth.textContent = 'Already have an account? Login here.';
  }
  errorMsg.textContent = '';
});

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  errorMsg.textContent = '';
  
  const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';
  
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await res.json();
    if (!res.ok) {
      errorMsg.textContent = data.error || 'Authentication failed';
      return;
    }
    
    // Save token and username
    localStorage.setItem('ai_ops_token', data.token);
    localStorage.setItem('ai_ops_user', data.username);
    
    // Redirect to main app
    window.location.href = 'chat.html';
  } catch(err) {
    errorMsg.textContent = 'Network error. Make sure server is running.';
  }
});
