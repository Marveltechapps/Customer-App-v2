import React from 'react';
import SupportLiveChat from '../components/features/support/SupportLiveChat';

const GeneralChat: React.FC = () => (
  <SupportLiveChat
    headerTitle="Chat Support"
    ticket={{
      subject: 'General Chat Support',
      type: 'general_inquiry',
    }}
  />
);

export default GeneralChat;
