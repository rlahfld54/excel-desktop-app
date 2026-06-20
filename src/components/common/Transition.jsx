import React, { useContext, useEffect, useRef } from 'react';
import { CSSTransition as ReactCSSTransition } from 'react-transition-group';

const TransitionContext = React.createContext({
  parent: {},
});

function useIsInitialRender() {
  const isInitialRender = useRef(true);

  useEffect(() => {
    isInitialRender.current = false;
  }, []);

  return isInitialRender.current;
}

function CSSTransition({
  show,
  enter = '',
  enterStart = '',
  enterEnd = '',
  leave = '',
  leaveStart = '',
  leaveEnd = '',
  appear,
  unmountOnExit,
  tag = 'div',
  children,
  ...rest
}) {
  const enterClasses = enter.split(' ').filter(Boolean);
  const enterStartClasses = enterStart.split(' ').filter(Boolean);
  const enterEndClasses = enterEnd.split(' ').filter(Boolean);
  const leaveClasses = leave.split(' ').filter(Boolean);
  const leaveStartClasses = leaveStart.split(' ').filter(Boolean);
  const leaveEndClasses = leaveEnd.split(' ').filter(Boolean);
  const nodeRef = useRef(null);
  const Component = tag;

  const addClasses = (classes) => {
    if (nodeRef.current && classes.length) nodeRef.current.classList.add(...classes);
  };

  const removeClasses = (classes) => {
    if (nodeRef.current && classes.length) nodeRef.current.classList.remove(...classes);
  };

  return (
    <ReactCSSTransition
      appear={appear}
      nodeRef={nodeRef}
      unmountOnExit={unmountOnExit}
      in={show}
      addEndListener={(done) => {
        nodeRef.current?.addEventListener('transitionend', done, { once: true });
      }}
      onEnter={() => {
        if (!unmountOnExit && nodeRef.current) nodeRef.current.style.display = '';
        addClasses([...enterClasses, ...enterStartClasses]);
      }}
      onEntering={() => {
        removeClasses(enterStartClasses);
        addClasses(enterEndClasses);
      }}
      onEntered={() => removeClasses([...enterEndClasses, ...enterClasses])}
      onExit={() => addClasses([...leaveClasses, ...leaveStartClasses])}
      onExiting={() => {
        removeClasses(leaveStartClasses);
        addClasses(leaveEndClasses);
      }}
      onExited={() => {
        removeClasses([...leaveEndClasses, ...leaveClasses]);
        if (!unmountOnExit && nodeRef.current) nodeRef.current.style.display = 'none';
      }}
    >
      <Component ref={nodeRef} {...rest} style={{ display: !unmountOnExit ? 'none' : undefined }}>
        {children}
      </Component>
    </ReactCSSTransition>
  );
}

export default function Transition({ show, appear, ...rest }) {
  const { parent } = useContext(TransitionContext);
  const isInitialRender = useIsInitialRender();

  if (show === undefined) {
    return (
      <CSSTransition
        appear={parent.appear || !parent.isInitialRender}
        show={parent.show}
        {...rest}
      />
    );
  }

  return (
    <TransitionContext.Provider value={{ parent: { show, isInitialRender, appear } }}>
      <CSSTransition appear={appear} show={show} {...rest} />
    </TransitionContext.Provider>
  );
}
