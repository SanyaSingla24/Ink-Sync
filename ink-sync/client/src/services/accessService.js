import API from './api';

export const requestAccess = async (roomId) => {
  const { data } = await API.post(`/access/rooms/${roomId}/request`);
  return data;
};

export const approveAccess = async (roomId, targetUserId) => {
  const { data } = await API.post(`/access/rooms/${roomId}/approve/${targetUserId}`);
  return data.data;
};

export const rejectAccess = async (roomId, targetUserId) => {
  const { data } = await API.post(`/access/rooms/${roomId}/reject/${targetUserId}`);
  return data;
};

export const removeParticipant = async (roomId, targetUserId) => {
  const { data } = await API.post(`/access/rooms/${roomId}/remove/${targetUserId}`);
  return data;
};

export const getPendingRequests = async (roomId) => {
  const { data } = await API.get(`/access/rooms/${roomId}/pending`);
  return data.data;
};