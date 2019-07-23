import React from 'react';
import ProfileForm from './ProfileForm';
import {Container} from 'native-base';
import Main from '../components-shared/Main';

class PageProfileCreate extends React.Component {
  render() {
    return (
      <Main title="Create Server" onBack={true} onReset={true}>
        <ProfileForm />
      </Main>
        
      
    );
  }
}
export default PageProfileCreate;