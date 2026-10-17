import API from './api';

export const getRooms = async () => {
  const { data } = await API.get('/rooms');
  return data.data;
};

export const createRoom = async (name) => {
  const { data } = await API.post('/rooms', { name });
  return data.data;
};

export const joinRoom = async (roomId) => {
  const { data } = await API.post(`/rooms/${roomId}/join`);
  return data.data;
};

export const deleteRoom = async (roomId) => {
  const { data } = await API.delete(`/rooms/${roomId}`);
  return data;
};