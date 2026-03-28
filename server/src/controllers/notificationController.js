const { getSupabaseAdmin } = require('../config/supabase');
const { mapNotification } = require('../utils/formatters');

exports.listNotifications = async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const limit = parseInt(req.query.limit, 10) || 50;
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    res.json((data || []).map(mapNotification));
  } catch (error) {
    console.error('List notifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = req.params;

    const { data: notification, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select('*')
      .maybeSingle();

    if (error) throw error;

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json(mapNotification(notification));
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', req.user.id)
      .eq('read', false);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Mark all notifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
