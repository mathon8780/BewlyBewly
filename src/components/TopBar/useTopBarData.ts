import type { UnwrapNestedRefs } from 'vue'

import api from '~/utils/api'

import type { UnReadDm, UnReadMessage, UserInfo } from './types'
import { useTopBarPolling } from './useTopBarPolling'

export function useTopBarData() {
  const userInfo = reactive<UserInfo | NonNullable<unknown>>({}) as UnwrapNestedRefs<UserInfo>
  const isLogin = ref(true)
  let unreadLoading = false
  let momentsLoading = false
  const { isActive, isAlive } = useTopBarPolling(getUserInfo, () =>
    Promise.all([getUnreadMessageCount(), getTopBarNewMomentsCount()]))

  async function getUserInfo() {
    try {
      const res = await api.user.getUserInfo()
      if (!isAlive())
        return

      if (res.code === 0) {
        isLogin.value = true
        Object.assign(userInfo, res.data)
      }
      // Account not logged in
      else if (res.code === -101) {
        isLogin.value = false
      }
    }
    catch (error) {
      if (!isAlive())
        return
      isLogin.value = false
      console.error(error)
    }
  }

  // #region Notifications
  const unReadMessage = reactive<UnReadMessage | NonNullable<unknown>>({}) as UnwrapNestedRefs<UnReadMessage>
  const unReadDm = reactive<UnReadDm>({} as UnwrapNestedRefs<UnReadDm>)
  const unReadMessageCount = ref<number>(0)

  async function getUnreadMessageCount() {
    if (!isActive() || !isLogin.value || unreadLoading)
      return

    unreadLoading = true
    let result = 0

    try {
      let res
      res = await api.notification.getUnreadMsg()
      if (!isActive())
        return
      if (res.code === 0) {
        Object.assign(unReadMessage, res.data)
        Object.entries(unReadMessage).forEach(([key, value]) => {
          if (key !== 'up' && key !== 'recv_reply' && key !== 'recv_like') {
            if (typeof value === 'number')
              result += value
          }
        })
      }

      res = await api.notification.getUnreadDm()
      if (!isActive())
        return
      if (res.code === 0) {
        Object.assign(unReadDm, res.data)
        if (typeof unReadDm.follow_unread === 'number')
          result += unReadDm.follow_unread
      }
    }
    catch (error) {
      console.error(error)
    }
    finally {
      unreadLoading = false
      if (isActive())
        unReadMessageCount.value = result
    }
  }

  // #region Moments
  const newMomentsCount = ref<number>(0)

  async function getTopBarNewMomentsCount() {
    if (!isActive() || !isLogin.value || momentsLoading)
      return

    momentsLoading = true
    let result = 0

    try {
      const res = await api.moment.getTopBarNewMomentsCount()
      if (res.code === 0) {
        if (typeof res.data.update_info.item.count === 'number')
          result = res.data.update_info.item.count
      }
    }
    catch (error) {
      console.error(error)
    }
    finally {
      momentsLoading = false
      if (isActive())
        newMomentsCount.value = result
    }
  }
  // #endregion
  return {
    userInfo,
    isLogin,
    isAlive,
    unReadMessageCount,
    newMomentsCount,
    getUnreadMessageCount,
    getTopBarNewMomentsCount,
  }
}
