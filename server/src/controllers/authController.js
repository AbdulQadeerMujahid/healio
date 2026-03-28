const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getSupabaseAdmin } = require('../config/supabase');
const { mapUser } = require('../utils/formatters');

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

exports.register = async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { name, email, password } = req.body;

    if (!name || !email || !password) return res.status(400).json({ message: 'Missing fields' });

    const normalizedEmail = String(email).toLowerCase().trim();

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existing) return res.status(409).json({ message: 'Email already in use' });

    const password_hash = await bcrypt.hash(password, 10);
    const { data: inserted, error } = await supabase
      .from('users')
      .insert({ name, email: normalizedEmail, password_hash, role: 'patient' })
      .select('id, name, email, role, specialization, experience, created_at, updated_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ message: 'Email already in use' });
      }
      throw error;
    }

    const user = mapUser(inserted);
    const token = signToken(user);
    res.status(201).json({ token, user: { id: user.id, _id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Separate doctor registration with specialization
exports.registerDoctor = async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { name, email, password, specialization } = req.body;

    if (!name || !email || !password || !specialization) {
      return res.status(400).json({ message: 'Missing fields' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const { data: inserted, error } = await supabase
      .from('users')
      .insert({
        name,
        email: normalizedEmail,
        password_hash,
        role: 'doctor',
        specialization,
      })
      .select('id, name, email, role, specialization, experience, created_at, updated_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ message: 'Email already in use' });
      }
      throw error;
    }

    const user = mapUser(inserted);
    const token = signToken(user);
    const responseData = { 
      token, 
      user: { 
        id: user.id,
        _id: user._id,
        name: user.name, 
        email: user.email, 
        role: user.role, 
        specialization: user.specialization 
      } 
    };

    res.status(201).json(responseData);
  } catch (err) {
    console.error('Doctor registration error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { email, password } = req.body;

    const normalizedEmail = String(email || '').toLowerCase().trim();

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, role, specialization, password_hash, experience, created_at, updated_at')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (error) {
      console.error('Login query error:', error);
      return res.status(500).json({ message: 'Authentication service unavailable' });
    }

    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const ok = await bcrypt.compare(password || '', user.password_hash || '');
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const mappedUser = mapUser(user);
    const token = signToken(mappedUser);
    res.json({
      token,
      user: {
        id: mappedUser.id,
        _id: mappedUser._id,
        name: mappedUser.name,
        email: mappedUser.email,
        role: mappedUser.role,
        specialization: mappedUser.specialization,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.me = async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, role, specialization, experience, created_at, updated_at')
      .eq('id', req.user.id)
      .maybeSingle();

    if (error || !user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(mapUser(user));
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
